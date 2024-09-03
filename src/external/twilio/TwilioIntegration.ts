import { Twilio } from "twilio";
import type * as restate from "@restatedev/restate-sdk";
import AccessToken, { ChatGrant } from "twilio/lib/jwt/AccessToken";
import { Client as ConversationClient } from "@twilio/conversations";
import type { ConversationInstance } from "twilio/lib/rest/conversations/v1/conversation";
import { LeadVirtualObject } from "../../restate/LeadVirtualObject";
import type { ExternalIntegrationState, IExternalIntegration } from "../types";
import * as TwilioProxyAPI from "./TwilioProxyAPI";
import { type E164Number, parsePhoneNumber } from "libphonenumber-js";
import type { Web2TextLead } from "../../types";
import type { TypedState } from "@restatedev/restate-sdk/dist/cjs/src/context";

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
		// TODO: Don't hardcode, fetch from Nexus API
		const DealerPhoneNumber = parsePhoneNumber("+12246591931", "US").number;
		const UniversalRetailerId = leadState.UniversalRetailerId;
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
			conversation = await context.run(
				"Twilio Fetch Pre-Existing Conversation",
				async () =>
					await this.twilioClient.conversations.v1
						.conversations(preExistingConversationID)
						.update((err, conv) => {
							// Add this LeadID to the conversation meta data
							const attributes = JSON.parse(conv?.attributes ?? "{}");
							attributes["LeadIds"] = Array.from(
								new Set([...(attributes["LeadIds"] ?? []), leadState.LeadId]),
							);
							conv!.attributes = JSON.stringify(attributes);
							return conv;
						}),
			);
		} else {
			conversation = await context.run(
				"Twilio Proxy Conversation Create API Call",
				async () =>
					await TwilioProxyAPI.CreateSession(
						[leadState.Lead.PhoneNumber, DealerPhoneNumber],
						{
							friendlyName: `Client: [${leadState.UniversalRetailerId}]\nLocation: [${leadState.LocationId}]\nWeb2Text Lead with [${leadState.Lead.PhoneNumber}]`,
							"timers.inactive": "P30D",
							attributes: JSON.stringify({
								LeadIDs: [leadState.LeadId],
								UniversalRetailerId,
								LocationID: leadState.LocationId
							}),
						},
					),
			);
			const systemParticipant = await context.run(
				"Add Broadlume as Chat Participant",
				async () =>
					await this.twilioClient.conversations.v1
						.conversations(conversation.sid)
						.participants.create({ identity: "Broadlume" }),
			);
		}

		await context.run("Send initial message", async () => {
			await this.sendSystemMessage(state, conversation, context, "Hello from Broadlume! We've set up a chat session between you and the dealer.");
		});
		return {
			...state,
			SyncStatus: "SYNCED",
			Data: {
				ConversationSID: conversation.sid,
				ConversationStatus: conversation.state,
			},
			LastSynced: new Date().toISOString(),
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
			const LeadId = (await context.get(
				"LeadId",
			))!;
			context
				.objectSendClient(LeadVirtualObject, LeadId)
				.close(process.env.INTERNAL_TOKEN);
		}
		return {
			...state,
			SyncStatus: "SYNCED",
			Data: {
				ConversationSID: conversationSID,
				ConversationStatus: conversation.state,
			},
			LastSynced: new Date().toISOString(),
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
			await context.run("Send closing message", async () => {
				await this.sendSystemMessage(
					state,
					conversation,
					context,
					"Hello from Broadlume! We've marked this conversation as closed due to inactivity. If you would like to re-open it, please reply 'CONTINUE' and we will open a new conversation.",
				);
			});
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
			LastSynced: new Date().toISOString(),
		};
	}
	private async checkForPreexistingConversation(
		customerPhone: E164Number,
		dealerPhone: E164Number,
	): Promise<string | null> {
		const conversationsUserIsIn =
			await this.twilioClient.conversations.v1.participantConversations
				.list({
					address: customerPhone,
				})
				.then((convos) => convos.filter(c => c.conversationState !== "closed").map((c) => c.conversationSid));
		const conversationsDealerIsIn =
			await this.twilioClient.conversations.v1.participantConversations
				.list({
					address: dealerPhone,
				})
				.then((convos) => convos.filter(c => c.conversationState !== "closed").map((c) => c.conversationSid));
		const conversation = conversationsUserIsIn.filter(x => conversationsDealerIsIn.includes(x));
		return conversation?.[0];
	}
	private async sendSystemMessage<T extends TypedState>(
		state: TwilioIntegrationState,
		twilioConversation: ConversationInstance,
		context: restate.ObjectSharedContext<T>,
		message: string,
	) {
		const chatGrant = new ChatGrant({
			serviceSid: twilioConversation.chatServiceSid,
		});
		const apiKey = process.env.TWILIO_API_SID!;
		const apiSecret = process.env.TWILIO_API_SECRET!;
		const token = new AccessToken(
			twilioConversation.accountSid,
			apiKey,
			apiSecret,
			{
				identity: "Broadlume",
			},
		);
		token.addGrant(chatGrant);
		const conversationClient: ConversationClient = await new Promise(
			(resolve, reject) => {
				const client = new ConversationClient(token.toJwt());
				client.on("stateChanged", (state) => {
					switch (state) {
						case "failed":
							return reject("Conversation client failed to create");
						case "initialized":
							return resolve(client);
					}
				});
			},
		);
		(
			await conversationClient.getConversationBySid(twilioConversation.sid)
		).sendMessage(message);
	}
}
