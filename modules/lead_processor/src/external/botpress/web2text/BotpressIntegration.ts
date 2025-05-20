import type { ObjectSharedContext } from "@restatedev/restate-sdk";
import {
	type ExternalIntegrationState,
	IExternalIntegration,
} from "common/external";
import { BotpressTableAPI } from "common/external/botpress";
import type { SubmittedLeadState } from "#lead";
import type { Web2TextLead } from "#lead/web2text";

export interface BotpressIntegrationState extends ExternalIntegrationState {
	Data?: {
		ConversationId: string;
		Conversation?: {
			id: number;
			createdAt: string;
			updatedAt: string;
			conversationId: string;
			transcript: {
				sender: string;
				preview: string;
			}[];
			summary: string;
			sentiment: "positive" | "negative" | "neutral";
			topics: string[] | null;
			escalations: any | null;
			resolved: boolean;
			computed: any;
		};
	};
}
export class BotpressIntegration extends IExternalIntegration<
	SubmittedLeadState<Web2TextLead>,
	BotpressIntegrationState
> {
	Name = "Botpress";
	override async shouldRun(
		context: ObjectSharedContext<SubmittedLeadState<Web2TextLead>>,
	): Promise<boolean> {
		const lead = await context.getAll();
		if (lead.Lead.BotpressConversationId == null) {
			return false;
		}
		return true;
	}
	defaultState(): BotpressIntegrationState {
		return {
			SyncStatus: "NOT SYNCED",
		};
	}
	async create(
		state: BotpressIntegrationState,
		context: ObjectSharedContext<SubmittedLeadState<Web2TextLead>>,
	): Promise<BotpressIntegrationState> {
		const lead = await context.getAll();
		if (lead.Lead.BotpressConversationId == null) {
			throw new Error("Botpress Conversation ID is not set");
		}
		const botpressAIData = await context.run(
			"Fetching Botpress AI Summary",
			async () => {
				const response = await BotpressTableAPI.FindTableRows(
					"Int_Connor_Conversations_Table",
					process.env.BOTPRESS_BOT_ID!,
					process.env.BOTPRESS_WORKSPACE_ID!,
					{
						filter: {
							conversationId: { $eq: lead.Lead.BotpressConversationId },
						},
					},
				);
				if (response?.rows.length && response.rows.length > 0) {
					return response.rows[0];
				}
				return null;
			},
			{
				maxRetryAttempts: 3,
			},
		);
		if (botpressAIData) {
			return {
				...state,
				SyncStatus: "SYNCED",
				Data: {
					ConversationId: lead.Lead.BotpressConversationId,
					Conversation: botpressAIData as any,
				},
				LastSynced: new Date(await context.date.now()).toISOString(),
			};
		}
		return {
			...state,
			SyncStatus: "ERROR",
			ErrorInfo: {
				Message: "No Botpress AI Summary found",
				ErrorDate: new Date(await context.date.now()).toISOString(),
			},
		};
	}
	async sync(
		state: BotpressIntegrationState,
		context: ObjectSharedContext<SubmittedLeadState<Web2TextLead>>,
	): Promise<BotpressIntegrationState> {
		return state;
	}
	async close(
		state: BotpressIntegrationState,
		context: ObjectSharedContext<SubmittedLeadState<Web2TextLead>>,
	): Promise<BotpressIntegrationState> {
		return state;
	}
}
