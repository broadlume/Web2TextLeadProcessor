import * as restate from "@restatedev/restate-sdk";
import {
	GetRunningEnvironment,
	isDeployed,
	isProductionAndDeployed,
} from "common";
import type {
	ExternalIntegrationState,
	IExternalIntegration,
} from "common/external";
import { NexusRetailerAPI, NexusStoresAPI } from "common/external/nexus";
import {
	TwilioConversationHelpers,
	TwilioProxyAPI,
} from "common/external/twilio";
import { type E164Number, parsePhoneNumber } from "libphonenumber-js";
import { assert, is } from "tsafe";
import type { Twilio } from "twilio";
import type { ConversationInstance } from "twilio/lib/rest/conversations/v1/conversation";
import { LeadVirtualObject } from "../../restate/services/LeadVirtualObject";
import { IsPhoneNumberOptedOut } from "../../restate/validators";
import type { Web2TextLead } from "../../types";
import type { LeadState } from "../../types";
import {
	DealerCloseMessage,
	DealerGreetMessage,
	SystemGreetingMessage,
} from "./Web2TextMessagingStrings";

export interface TwilioIntegrationState extends ExternalIntegrationState {
	Data?: {
		ConversationSID: string;
		ConversationStatus: "active" | "inactive" | "closed";
	};
}

export class TwilioIntegration
	implements IExternalIntegration<LeadState, TwilioIntegrationState>
{
	readonly CONVERSATION_CLOSED_TIMER = isProductionAndDeployed()
		? "P30D"
		: "P1D";
	readonly CONVERSATION_INACTIVE_TIMER = isProductionAndDeployed()
		? "P7D"
		: undefined;
	Name = "Twilio";
	defaultState(): TwilioIntegrationState {
		return {
			SyncStatus: "NOT SYNCED",
		};
	}
	private twilioClient: Twilio;
	constructor(client?: Twilio) {
		client ??= globalThis.TWILIO_CLIENT;
		this.twilioClient = client;
	}
	async create(
		state: TwilioIntegrationState,
		context: restate.ObjectSharedContext<Web2TextLead>,
	): Promise<TwilioIntegrationState> {
		const leadState = await context.getAll();
		const locationInformation = await context.run(
			"Get retailer store from Nexus",
			async () => NexusStoresAPI.GetRetailerStoreByID(leadState.LocationId),
		);
		if (locationInformation === null) {
			throw new Error(
				`Location info is missing in Nexus for location ID '${leadState.LocationId}'`,
			);
		}
		const dealerInformation = await context.run(
			"Get retailer info from Nexus",
			async () =>
				await NexusRetailerAPI.GetRetailerByID(leadState.UniversalRetailerId),
		);
		if (dealerInformation === null) {
			throw new Error(
				`Retailer info is missing in Nexus for Universal Retailer ID '${leadState.UniversalRetailerId}'`,
			);
		}
		const storePhoneNumber = parsePhoneNumber(
			locationInformation.Web2Text_Phone_Number!,
			"US",
		).number;
		const { isNewConversation, conversation } = await context.run(
			"Create Web2Text conversation",
			async () =>
				this.createWeb2TextConversation(
					leadState,
					storePhoneNumber,
					dealerInformation,
					locationInformation,
				),
			{
				maxRetryAttempts: 4,
				initialRetryIntervalMillis: 500,
			},
		);
		if (!isNewConversation) {
			context.console.info(
				`Found pre-existing Twilio Conversation: ${conversation.sid}`,
				{
					_meta: 1,
					label: [`${this.Name}/createWeb2TextConversation`],
				},
			);
		}
		const dealerMessaging = DealerGreetMessage(
			leadState,
			locationInformation.location_name ?? locationInformation.street_address,
		);
		await context.run("Send dealer messaging", async () => {
			await this.sendSystemMessage(
				conversation.sid,
				dealerMessaging,
				leadState.Lead.PhoneNumber,
				false,
			);
		});
		await context.run("Send customer message", async () => {
			const systemMessaging = SystemGreetingMessage(
				dealerInformation.name,
				leadState.Lead.PreferredMethodOfContact,
			);
			await this.sendSystemMessage(
				conversation.sid,
				systemMessaging,
				storePhoneNumber,
				false,
			);
		});

		return {
			...state,
			SyncStatus: "SYNCED",
			Data: {
				ConversationSID: conversation.sid,
				ConversationStatus: conversation.state,
			},
			LastSynced: new Date(await context.date.now()).toISOString(),
		};
	}
	async sync(
		state: TwilioIntegrationState,
		context: restate.ObjectSharedContext<Web2TextLead>,
	): Promise<TwilioIntegrationState> {
		const lead = await context.getAll();
		const conversationSID = state.Data?.ConversationSID!;
		if (conversationSID == null) {
			throw new Error("Conversation SID is null!");
		}
		const conversation = await context.run(
			"Fetching Twilio conversation",
			async () =>
				this.twilioClient.conversations.v1
					.conversations(conversationSID)
					.fetch()
					.catch((e) => {
						if ("code" in e && e.code === 404) return null;
						throw e;
					}),
		);
		const newState: TwilioIntegrationState = {
			...state,
			SyncStatus: "SYNCED",
			Data: {
				ConversationSID: conversationSID,
				ConversationStatus: conversation?.state ?? "closed",
			},
			LastSynced: new Date(await context.date.now()).toISOString(),
		};
		// Signal to close this lead if the Twilio conversation is closed
		if (conversation == null || conversation.state === "closed") {
			context
				.objectSendClient(LeadVirtualObject, lead.LeadId)
				.close({ reason: "Inactivity" });
			return newState;
		}
		const participants = await context.run(
			"Get conversation participants",
			async () =>
				await this.twilioClient.conversations.v1
					.conversations(conversation.sid)
					.participants.list()
					.then((pa) => pa.map((p) => p.toJSON())),
		);
		const phoneNumbers = participants
			.map((p) => p.messagingBinding?.address)
			.filter((p) => p != null);
		if (phoneNumbers.length <= 1) {
			// Close the lead if no phone numbers left in conversation
			context
				.objectSendClient(LeadVirtualObject, lead.LeadId)
				.close({ reason: "One or fewer participants left in conversation" });
			return newState;
		}
		const hasCustomerOptedOut = await context.run(
			"Check for opted out numbers",
			async () => await IsPhoneNumberOptedOut(lead.Lead.PhoneNumber),
		);
		if (hasCustomerOptedOut) {
			// Close the lead if the customer has opted out of text messaging
			context
				.objectSendClient(LeadVirtualObject, lead.LeadId)
				.close({ reason: "Customer opted out of text messaging" });
			return newState;
		}
		return newState;
	}
	async close(
		state: TwilioIntegrationState,
		context: restate.ObjectSharedContext<Web2TextLead>,
	): Promise<TwilioIntegrationState> {
		const lead = await context.getAll();
		const conversationID = state.Data?.ConversationSID;
		if (conversationID == null) return state;
		const conversation = await context.run("Get conversation", async () =>
			this.twilioClient.conversations.v1
				.conversations(conversationID)
				.fetch()
				.catch((e) => {
					if ("code" in e && e.code === 404) return null;
					throw e;
				}),
		);
		if (conversation == null || conversation.state === "closed") {
			return {
				...state,
				SyncStatus: "CLOSED",
				Data: {
					...state.Data,
					ConversationSID: conversationID,
					ConversationStatus: "closed",
				},
			};
		}
		// Remove this LeadID from attributes
		const attributes = JSON.parse(conversation?.attributes ?? "{}");
		const leadIds = new Set(attributes["LeadIds"] ?? []);
		leadIds.delete(lead.LeadId);
		attributes["LeadIds"] = Array.from(leadIds);

		const update: Partial<ConversationInstance> = {
			attributes: attributes,
		};
		// If no other leads are using this conversation, close it
		if (attributes["LeadIds"].length === 0) {
			update.state = "closed";
			await context.run("Send dealer closing message", async () => {
				await this.sendSystemMessage(
					conversationID,
					DealerCloseMessage(lead.Lead.Name, lead.CloseReason),
					lead.Lead.PhoneNumber,
					true,
				).catch((e) => null); // ignore error
			});
		}
		await context.run("Update twilio conversation", async () => {
			await this.twilioClient.conversations.v1
				.conversations(conversationID)
				.update(update);
		});
		return {
			...state,
			SyncStatus: "CLOSED",
			Data: {
				...state.Data!,
				ConversationSID: conversationID,
				ConversationStatus: update.state ?? conversation.state,
			},
			LastSynced: new Date(await context.date.now()).toISOString(),
		};
	}
	private async sendSystemMessage(
		conversationSid: string,
		message: string,
		author: string = "Broadlume",
		waitForDelivery: boolean = false,
	) {
		const twilioMessage = await this.twilioClient.conversations.v1
			.conversations(conversationSid)
			.messages.create({
				author: author,
				body: message,
				attributes: JSON.stringify({
					SystemMessage: true,
				}),
			});
		if (!waitForDelivery) {
			return;
		}
		await new Promise((resolve, reject) => {
			let attempts = 10;
			const interval = setInterval(async () => {
				const deliveryReceipts = await this.twilioClient.conversations.v1
					.conversations(conversationSid)
					.messages.get(twilioMessage.sid)
					.deliveryReceipts.list();
				if (
					deliveryReceipts.every(
						(d) => d.status === "delivered" || d.status === "read",
					)
				) {
					clearInterval(interval);
					resolve(undefined);
				}

				const failedDelivery = deliveryReceipts.find(
					(d) => d.status === "failed" || d.status === "undelivered",
				);
				if (failedDelivery) {
					clearInterval(interval);
					if (failedDelivery.errorCode === 21610) {
						reject(
							new restate.TerminalError(
								`Participant has opted out of communication from this number for Twilio message '${twilioMessage.sid}`,
								{
									errorCode: 500,
									cause: "OPT_OUT",
								},
							),
						);
					}
					if (failedDelivery.errorCode === 30034) {
						reject(
							new restate.TerminalError(
								"One of the numbers is not registered with A2P 10DLC and cannot send text messages",
							),
						);
					} else {
						reject(
							new restate.TerminalError(
								`Delivery status is 'failed' for Twilio message '${twilioMessage.sid}'`,
							),
						);
					}
				}
				if (attempts <= 0) {
					clearInterval(interval);
					reject(
						new restate.TerminalError(
							`Max attempts exceeded for polling for Twilio message delivery status on message '${twilioMessage.sid}'`,
						),
					);
				}
				attempts -= 1;
			}, 1000);
		});
	}
	private async createWeb2TextConversation(
		leadState: Web2TextLead,
		storePhoneNumber: E164Number,
		dealerInformation: NexusRetailerAPI.NexusRetailer,
		locationInformation: NexusStoresAPI.RetailerStore,
	): Promise<{
		isNewConversation: boolean;
		conversation: ConversationInstance;
	}> {
		const preExistingConversation =
			await TwilioConversationHelpers.FindConversationsFor(
				this.twilioClient,
				[leadState.Lead.PhoneNumber, storePhoneNumber],
				["active", "inactive"],
				process.env.TWILIO_MESSAGING_SERVICE_SID,
			).then((convos) => convos?.[0]);
		let conversation: ConversationInstance;
		if (preExistingConversation) {
			// Add this LeadID to the conversation metadata
			const attributes = JSON.parse(preExistingConversation.attributes ?? "{}");
			const leadIds = new Set(attributes["LeadIds"] ?? []);
			leadIds.add(leadState.LeadId);
			attributes["LeadIds"] = Array.from(leadIds);
			const update: Record<string, string> = {
				attributes: JSON.stringify(attributes),
			};
			if (preExistingConversation!.state !== "active") {
				update.state = "active";
			}
			conversation = await this.twilioClient.conversations.v1
				.conversations(preExistingConversation.sid)
				.update(update);
		} else {
			conversation = await TwilioProxyAPI.CreateSession(
				[leadState.Lead.PhoneNumber, storePhoneNumber],
				{
					friendlyName: `Client: [${dealerInformation.name}]\nLocation: [${locationInformation.location_name ?? locationInformation.street_address}]\nWeb2Text Lead with [${leadState.Lead.PhoneNumber}]`,
					"timers.inactive": this.CONVERSATION_INACTIVE_TIMER,
					"timers.closed": this.CONVERSATION_CLOSED_TIMER,
					attributes: JSON.stringify({
						LeadIds: [leadState.LeadId],
						DealerName: dealerInformation.name,
						DealerURL: dealerInformation.website_url,
						StorePhoneNumber: storePhoneNumber,
						CustomerName: leadState.Lead.Name,
						UniversalRetailerId: leadState.UniversalRetailerId,
						LocationID: leadState.LocationId,
						Environment: GetRunningEnvironment(),
					}),
					messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
				},
			);
		}

		this.twilioClient.conversations.v1
			.conversations(conversation.sid)
			.participants.create({ identity: "Broadlume" })
			.catch((e) => {
				assert(is<Error>(e));
				// Participant already exists, so do nothing
				if ("code" in e && e.code === 50433) {
					return;
				}
				throw e;
			});

		// Attach Twilio webhooks only when deployed
		if (isDeployed()) {
			const ingressUrl = process.env.PUBLIC_RESTATE_INGRESS_URL;
			const syncEndpoint = new URL("TwilioWebhooks/sync", ingressUrl);
			syncEndpoint.port = "";
			const closeEndpoint = new URL(
				"TwilioWebhooks/close",
				ingressUrl,
			);
			closeEndpoint.port = "";
			const activeWebhooks = await this.twilioClient.conversations.v1
				.conversations(conversation.sid)
				.webhooks.list();
			const hasSyncWebhook = activeWebhooks.find((w) =>
				encodeURI(syncEndpoint.toString()),
			);
			const hasCloseWebhook = activeWebhooks.find((w) =>
				encodeURI(closeEndpoint.toString()),
			);
			if (!hasSyncWebhook) {
				await this.twilioClient.conversations.v1
					.conversations(conversation.sid)
					.webhooks.create({
						"configuration.url": encodeURI(syncEndpoint.toString()),
						"configuration.method": "POST",
						target: "webhook",
						"configuration.filters": [
							"onMessageAdded",
							"onMessageRemoved",
							"onMessageUpdated",
						],
					});
			}
			if (!hasCloseWebhook) {
				await this.twilioClient.conversations.v1
					.conversations(conversation.sid)
					.webhooks.create({
						"configuration.url": encodeURI(closeEndpoint.toString()),
						"configuration.method": "POST",
						target: "webhook",
						"configuration.filters": ["onConversationStateUpdated"],
					});
			}
		}
		const attributes = JSON.parse(conversation.attributes ?? "{}");
		const leadIds: string[] = attributes["LeadIds"];
		return {
			isNewConversation: leadIds.length === 1,
			conversation: conversation,
		};
	}
}
