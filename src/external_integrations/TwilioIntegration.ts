import { Twilio } from "twilio";
import type { ExternalIntegrationState, IExternalIntegration } from ".";
import type * as restate from "@restatedev/restate-sdk";
import { LeadState, type SubmittedLeadState } from "../restate/common";
import AccessToken, { ChatGrant } from "twilio/lib/jwt/AccessToken";
import { Client as ConversationClient } from "@twilio/conversations";
import type { ConversationInstance } from "twilio/lib/rest/conversations/v1/conversation";
import type { MessageInstance } from "twilio/lib/rest/api/v2010/account/message";

type SerializedTwilioChatMessage = {
	accountSid: string;
	conversationSid: string;
	sid: string;
	index: number;
	author: string;
	body: string;
	media: unknown[];
	attributes: string;
	participantSid: string;
	dateCreated: Date;
	dateUpdated: Date;
	url: string;
	delivery: unknown;
	links: Record<string, string>;
	contentSid: string;
};
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
			Name: "Twilio",
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
		context: restate.ObjectSharedContext,
	): Promise<TwilioIntegrationState> {
		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		const LeadID = await context.get<SubmittedLeadState["LeadID"]>("LeadID")!;
		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		const Lead = await await context.get<SubmittedLeadState["Lead"]>("Lead")!;

		if (LeadID == null || Lead == null) {
			throw new Error("LeadID or Lead is null!");
		}
		// TODO: Don't hardcode, fetch from subaccount using Twilio API
		const DealerTwilioNumber = "+18332219478";
		const UniversalClientId = Lead.UniversalClientId;
		const preExistingConversationID =
			await this.checkForPreexistingConversation(
				Lead.LeadInformation.PhoneNumber,
				DealerTwilioNumber,
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
						.fetch(),
			);
		} else {
			conversation = await context.run(
				"Twilio Conversation Create API Call",
				async () =>
					await this.twilioClient.conversations.v1.conversations.create({
						attributes: JSON.stringify({
							LeadID,
							UniversalClientId,
						}),
						friendlyName: `Web2Text Lead Conversation: ${LeadID}`,
						"timers.inactive": "P1M",
					}),
			);
			const userParticipant = await context.run(
				"Add User as SMS Participant",
				async () =>
					await this.twilioClient.conversations.v1
						.conversations(conversation.sid)
						.participants.create({
							"messagingBinding.address": Lead.LeadInformation.PhoneNumber,
							"messagingBinding.proxyAddress": DealerTwilioNumber,
						}),
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
			await this.sendInitialMessage(state, conversation, context);
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
		context: restate.ObjectSharedContext,
	): Promise<TwilioIntegrationState> {
		// biome-ignore lint/style/noNonNullAssertion: <explanation>
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
		// Create a new conversation if this one is closed
		if (conversation.state === "closed") {
			return await this.create(state, context);
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
		context: restate.ObjectSharedContext,
	): Promise<TwilioIntegrationState> {
		return state;
	}
	private async checkForPreexistingConversation(
		customerPhone: string,
		dealerPhone: string,
	): Promise<string | null> {
		const conversations =
			await this.twilioClient.conversations.v1.participantConversations.list({
				address: customerPhone,
			});
		return (
			conversations.find(
				(x) =>
					x.participantMessagingBinding?.proxy_address === dealerPhone &&
					x.conversationState !== "closed",
			)?.conversationSid ?? null
		);
	}
	private async sendInitialMessage(
		state: TwilioIntegrationState,
		twilioConversation: ConversationInstance,
		context: restate.ObjectSharedContext,
	) {
		const chatGrant = new ChatGrant({
			serviceSid: twilioConversation.chatServiceSid,
		});
		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		const apiKey = process.env.TWILIO_API_SID!;
		// biome-ignore lint/style/noNonNullAssertion: <explanation>
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
		).sendMessage("Testing!");
	}
}
