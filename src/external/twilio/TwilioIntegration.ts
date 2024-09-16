import { Twilio } from "twilio";
import type * as restate from "@restatedev/restate-sdk";
import type { ConversationInstance } from "twilio/lib/rest/conversations/v1/conversation";
import { LeadVirtualObject } from "../../restate/LeadVirtualObject";
import type { ExternalIntegrationState, IExternalIntegration } from "../types";
import * as TwilioProxyAPI from "./TwilioProxyAPI";
import { type E164Number, parsePhoneNumber } from "libphonenumber-js";
import type { Web2TextLead } from "../../types";
import { NexusRetailerAPI, NexusStoresAPI } from "../nexus";
import {
	DealerGreetMessage,
	SystemCloseMessage,
	SystemGreetingMessage,
} from "./Web2TextMessagingStrings";
import { FindConversationFor } from "./TwilioConversationHelpers";

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
		// TODO: Don't hardcode, fetch from Nexus API
		const DealerPhoneNumber = parsePhoneNumber("+12246591931", "US").number;
		const UniversalRetailerId = leadState.UniversalRetailerId;
		const conversation: ConversationInstance = await context.run(
			"Create Twilio conversation",
			async () => {
				const preExistingConversationID =
					await this.checkForPreexistingConversation(
						leadState.Lead.PhoneNumber,
						DealerPhoneNumber,
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
						[leadState.Lead.PhoneNumber, DealerPhoneNumber],
						{
							friendlyName: `Client: [${dealerInformation.name}]\nLocation: [${locationInformation.location_name ?? locationInformation.street_address}]\nWeb2Text Lead with [${leadState.Lead.PhoneNumber}]`,
							"timers.inactive": "P30D",
							attributes: JSON.stringify({
								LeadIDs: [leadState.LeadId],
								UniversalRetailerId,
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
							"configuration.filters": [
								"onConversationStateUpdated",
							],
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
		await context.run("Send initial message", async () => {
			const systemMessaging = SystemGreetingMessage(dealerInformation.name);
			await this.sendSystemMessage(conversation.sid, systemMessaging);
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
		// Signal to close this lead if the Twilio conversation is closed
		if (conversation.state === "closed") {
			const LeadId = (await context.get("LeadId"))!;
			context
				.objectSendClient(LeadVirtualObject, LeadId)
				.close({reason: "TwilioIntegration Sync: conversation state was set to 'closed'"});
		}
		return {
			...state,
			SyncStatus: "SYNCED",
			Data: {
				ConversationSID: conversationSID,
				ConversationStatus: conversation.state,
			},
			LastSynced: new Date(await context.date.now()).toISOString(),
		};
	}
	async close(
		state: TwilioIntegrationState,
		context: restate.ObjectSharedContext<Web2TextLead>,
	): Promise<TwilioIntegrationState> {
		const LeadID = (await context.get("LeadId"))!;
		const conversationID = state.Data?.ConversationSID;
		if (conversationID == null) return state;
		const conversation = await this.twilioClient.conversations.v1
			.conversations(conversationID)
			.fetch();
		const attributes = JSON.parse(conversation?.attributes ?? "{}");
		attributes["LeadIds"] = ((attributes["LeadIds"] as string[]) ?? []).filter(
			(id) => id !== LeadID,
		);
		conversation.attributes = JSON.stringify(attributes);
		// If no other leads are using this conversation, close it
		if (attributes["LeadIds"].length === 0) {
			conversation.state = "closed";
		}
		await context.run("Remove Lead from Twilio Conversation", async () => {
			await this.twilioClient.conversations.v1
				.conversations(conversationID)
				.update({
					attributes: conversation.attributes,
					state: conversation.state,
				});
		});
		return {
			...state,
			SyncStatus: "SYNCED",
			Data: {
				...state.Data!,
				ConversationStatus: conversation.state,
			},
			LastSynced: new Date(await context.date.now()).toISOString(),
		};
	}
	private async checkForPreexistingConversation(
		customerPhone: E164Number,
		dealerPhone: E164Number,
	): Promise<string | null> {
		const conversationsUserIsIn = await FindConversationFor(this.twilioClient,customerPhone).then(convos => convos.map(c => c.conversationSid));
		const conversationsDealerIsIn = await FindConversationFor(this.twilioClient,dealerPhone).then(convos => convos.map(c => c.conversationSid));
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
				if (deliveryReceipts.every((d) => d.status === "delivered")) {
					clearInterval(interval);
					resolve(undefined);
				}
				if (deliveryReceipts.find((d) => d.status === "failed")) {
					clearInterval(interval);
					reject(
						new Error(
							`Delivery status is 'failed' for Twilio message '${twilioMessage.sid}'`,
						),
					);
				}
				if (attempts <= 0) {
					clearInterval(interval);
					reject(
						new Error(
							`Max attempts exceeded for polling for Twilio message delivery status on message '${twilioMessage.sid}'`,
						),
					);
				}
				attempts -= 1;
			}, 1000);
		});
	}
}
