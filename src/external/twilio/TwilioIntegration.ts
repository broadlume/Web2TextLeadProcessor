import { Twilio } from "twilio";
import * as restate from "@restatedev/restate-sdk";
import type { ConversationInstance } from "twilio/lib/rest/conversations/v1/conversation";
import { LeadVirtualObject } from "../../restate/LeadVirtualObject";
import type { ExternalIntegrationState, IExternalIntegration } from "../types";
import * as TwilioProxyAPI from "./TwilioProxyAPI";
import {
	type E164Number,
	isPossiblePhoneNumber,
	parsePhoneNumber,
} from "libphonenumber-js";
import type { Web2TextLead } from "../../types";
import { NexusRetailerAPI, NexusStoresAPI } from "../nexus";
import {
	DealerGreetMessage,
	SystemGreetingMessage,
	DealerCloseMessage,
} from "./Web2TextMessagingStrings";
import { FindConversationsFor } from "./TwilioConversationHelpers";
import { IsPhoneNumberOptedOut } from "../../restate/validators";

export interface TwilioIntegrationState extends ExternalIntegrationState {
	Data?: {
		ConversationSID: string;
		ConversationStatus: "active" | "inactive" | "closed";
	};
}

export class TwilioIntegration
	implements IExternalIntegration<TwilioIntegrationState>
{
	Name = "Twilio";
	defaultState(): TwilioIntegrationState {
		return {
			SyncStatus: "NOT SYNCED",
		};
	}
	private twilioClient: Twilio;
	constructor(client?: Twilio) {
		client ??= new Twilio(
			process.env.TWILIO_ACCOUNT_SID,
			process.env.TWILIO_AUTH_TOKEN,
		);
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
		const storePhoneNumber = parsePhoneNumber(locationInformation.Web2Text_Phone_Number!, "US").number;
		const universalRetailerId = leadState.UniversalRetailerId;
		const conversation: ConversationInstance = await context.run(
			"Create Twilio conversation",
			async () => {
				const preExistingConversationID =
					await this.checkForPreexistingConversation(
						leadState.Lead.PhoneNumber,
						storePhoneNumber,
					);
				let conversation: ConversationInstance;
				if (preExistingConversationID) {
					context.console.info(
						`Found pre-existing Twilio Conversation: ${preExistingConversationID}`,
					);
					conversation = await this.twilioClient.conversations.v1
						.conversations(preExistingConversationID)
						.update((err, conv) => {
							// Add this LeadID to the conversation meta data
							const attributes = JSON.parse(conv?.attributes ?? "{}");
							attributes["LeadIds"] = Array.from(
								new Set([...(attributes["LeadIds"] ?? []), leadState.LeadId]),
							);
							conv!.attributes = JSON.stringify(attributes);
							return conv;
						});
				} else {
					conversation = await TwilioProxyAPI.CreateSession(
						[leadState.Lead.PhoneNumber, storePhoneNumber],
						{
							friendlyName: `Client: [${dealerInformation.name}]\nLocation: [${locationInformation.location_name ?? locationInformation.street_address}]\nWeb2Text Lead with [${leadState.Lead.PhoneNumber}]`,
							"timers.inactive": "P7D",
							"timers.closed": "P14D",
							attributes: JSON.stringify({
								LeadIDs: [leadState.LeadId],
								DealerName: dealerInformation.name,
								DealerURL: dealerInformation.website_url,
								StorePhoneNumber: storePhoneNumber,
								CustomerName: leadState.Lead.Name,
								UniversalRetailerId: universalRetailerId,
								LocationID: leadState.LocationId,
								Environment:
									process.env["COPILOT_ENVIRONMENT_NAME"] ??
									"Local Development",
							}),
						},
					);
					const systemParticipant = await this.twilioClient.conversations.v1
						.conversations(conversation.sid)
						.participants.create({ identity: "Broadlume" });
				}
				return conversation;
			},
		);
		// Attach Twilio sync webhook only on production
		if (process.env.COPILOT_ENVIRONMENT_NAME) {
			const syncEndpoint = new URL(
				`TwilioWebhooks/${leadState.LeadId}/sync`,
				process.env.RESTATE_ADMIN_URL,
			);
			syncEndpoint.port = "";
			const syncWebhook = await context.run(
				"Add Twilio sync webhook",
				async () =>
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
						}),
			);
			const closeEndpoint = new URL(
				`TwilioWebhooks/${leadState.LeadId}/close`,
				process.env.RESTATE_ADMIN_URL,
			);
			closeEndpoint.port = "";

			const closeWebhook = await context.run(
				"Add Twilio close webhook",
				async () =>
					await this.twilioClient.conversations.v1
						.conversations(conversation.sid)
						.webhooks.create({
							"configuration.url": encodeURI(closeEndpoint.toString()),
							"configuration.method": "POST",
							target: "webhook",
							"configuration.filters": ["onConversationStateUpdated"],
						}),
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
				true,
			);
		});
		await context.run("Send customer message", async () => {
			const systemMessaging = SystemGreetingMessage(dealerInformation.name);
			await this.sendSystemMessage(
				conversation.sid,
				systemMessaging,
				storePhoneNumber,
				true,
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
					.fetch(),
		);
		const newState: TwilioIntegrationState = {
			...state,
			SyncStatus: "SYNCED",
			Data: {
				ConversationSID: conversationSID,
				ConversationStatus: conversation.state,
			},
			LastSynced: new Date(await context.date.now()).toISOString(),
		};
		// Signal to close this lead if the Twilio conversation is closed
		if (conversation.state === "closed") {
			context
				.objectSendClient(LeadVirtualObject, lead.LeadId)
				.close({ reason: "Inactivity" });
			return newState;
		}
		const participants = await context.run(
			"Get conversation participants",
			async () => await conversation.participants().list(),
		);
		const phoneNumbers = participants
			.map((p) => p.identity)
			.filter((p) => isPossiblePhoneNumber(p)) as E164Number[];
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
		const conversation = await this.twilioClient.conversations.v1
			.conversations(conversationID)
			.fetch();

		const attributes = JSON.parse(conversation?.attributes ?? "{}");
		attributes["LeadIds"] = ((attributes["LeadIds"] as string[]) ?? []).filter(
			(id) => id !== lead.LeadId,
		);
		conversation.attributes = JSON.stringify(attributes);
		let newConversationState = conversation.state;
		// If no other leads are using this conversation, close it
		if (attributes["LeadIds"].length === 0) {
			newConversationState = "closed";
			await context.run("Send dealer closing message", async () => {
				await this.sendSystemMessage(
					conversation.sid,
					DealerCloseMessage(lead.Lead.Name, lead.CloseReason),
					lead.Lead.PhoneNumber,
				).catch((e) => null); // ignore error
			});
		}
		if (conversation.state !== "closed") {
			await context.run("Update twilio conversation", async () => {
				await this.twilioClient.conversations.v1
					.conversations(conversationID)
					.update({
						attributes: conversation.attributes,
						state: newConversationState,
					});
			});
		}
		return {
			...state,
			SyncStatus: "CLOSED",
			Data: {
				...state.Data!,
				ConversationStatus: newConversationState,
			},
			LastSynced: new Date(await context.date.now()).toISOString(),
		};
	}
	private async checkForPreexistingConversation(
		customerPhone: E164Number,
		storePhone: E164Number,
	): Promise<string | null> {
		const conversationsUserIsIn = await FindConversationsFor(
			this.twilioClient,
			customerPhone,
		).then((convos) => convos.map((c) => c.conversationSid));
		const conversationsDealerIsIn = await FindConversationsFor(
			this.twilioClient,
			storePhone,
		).then((convos) => convos.map((c) => c.conversationSid));
		const conversation = conversationsUserIsIn.filter((x) =>
			conversationsDealerIsIn.includes(x),
		);
		return conversation?.[0];
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
				if (deliveryReceipts.every((d) => d.status === "delivered" || d.status === "read")) {
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
}
