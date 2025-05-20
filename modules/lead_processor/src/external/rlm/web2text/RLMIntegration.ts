import type * as restate from "@restatedev/restate-sdk";
import {
	type ExternalIntegrationState,
	IExternalIntegration,
} from "common/external";
import { NexusRetailerAPI, NexusStoresAPI } from "common/external/nexus";
import { RLMLeadsAPI, RLMLocationsAPI } from "common/external/rlm";
import { isValidPhoneNumber } from "libphonenumber-js";
import { serializeError } from "serialize-error";
import { assert, is } from "tsafe/assert";
import type { Twilio } from "twilio";
import type { BotpressIntegrationState } from "#external/botpress/web2text/BotpressIntegration";
import {
	Web2TextLeadIntoRLMLead,
	Web2TextMessageIntoRLMNote,
} from "#external/rlm/web2text/APIConverters";
import type { TwilioIntegrationState } from "#external/twilio/web2text/TwilioIntegration";
import type { SubmittedLeadState } from "#lead";
import type { Web2TextLead } from "#lead/web2text";

export interface RLMIntegrationState extends ExternalIntegrationState {
	Data?: {
		LeadId: number;
		LeadUUID: string;
		LocationName: string;
		SyncedMessageIds: string[];
		SentBotpressSummary?: boolean;
	};
}

export class RLMIntegration extends IExternalIntegration<
	SubmittedLeadState<Web2TextLead>,
	RLMIntegrationState
> {
	Name = "RLM";
	defaultState(): RLMIntegrationState {
		return {
			SyncStatus: "NOT SYNCED",
		};
	}
	private twilioClient: Twilio;
	public constructor(client?: Twilio) {
		super();
		client ??= globalThis.TWILIO_CLIENT;
		this.twilioClient = client;
	}
	private async getRLMLocationName(
		nexusLocationId: string,
	): Promise<RLMLocationsAPI.RLMDHQLocationMappingResponse[0] | null> {
		const rlmLocationsMapping = await RLMLocationsAPI.GetDHQLocationsMapping();
		const storeInformation =
			await NexusStoresAPI.GetRetailerStoreByID(nexusLocationId);
		if (storeInformation?.universal_id == null) return null;
		return (
			rlmLocationsMapping.find(
				(mapping) => mapping.dhq_store_id === storeInformation?.universal_id,
			) ?? null
		);
	}
	async create(
		state: RLMIntegrationState,
		context: restate.ObjectSharedContext<SubmittedLeadState<Web2TextLead>>,
	): Promise<RLMIntegrationState> {
		const leadState = await context.getAll();
		const retailer = await context.run(
			"Fetch Retailer from Nexus",
			async () =>
				await NexusRetailerAPI.GetRetailerByID(leadState.UniversalRetailerId),
		);
		const rlm_api_key =
			process.env["RLM_API_KEY_OVERRIDE"] ?? retailer?.rlm_api_key;
		if (rlm_api_key == null) {
			return {
				...state,
				SyncStatus: "ERROR",
				ErrorInfo: {
					Message: "RLM API Key is missing",
					ErrorDate: new Date(await context.date.now()).toISOString(),
				},
			};
		}
		const rlmLocationMapping = await context.run(
			"Get RLM location name",
			async () =>
				await this.getRLMLocationName(leadState.Lead.LocationId).catch(
					(e) => null,
				),
		);
		if (rlmLocationMapping == null) {
			context.console.warn(
				`Could not find RLM location mapping for nexus location id: '${leadState.Lead.LocationId}'`,
				{ _meta: 1, LeadState: leadState },
			);
		}
		const response = await context.run(
			"Create RLM Lead",
			async () =>
				await RLMLeadsAPI.CreateLead(
					leadState.LeadId,
					new Web2TextLeadIntoRLMLead(
						leadState,
						rlmLocationMapping?.location_name ?? undefined,
					),
					rlm_api_key!,
				).catch(
					(e) =>
						({
							result: "Error",
							Error: serializeError(e),
						}) as any,
				),
		);
		if (response.result !== "Success") {
			return {
				...state,
				SyncStatus: "ERROR",
				ErrorInfo: {
					Message: "Error with RLM lead endpoint",
					Details: {
						response: response,
					},
					ErrorDate: new Date(await context.date.now()).toISOString(),
				},
			};
		}
		const newState: RLMIntegrationState = {
			...state,
			SyncStatus: "SYNCED",
			LastSynced: new Date(await context.date.now()).toISOString(),
			Data: {
				LeadId: response.lead_id,
				LocationName:
					rlmLocationMapping?.location_name ?? "Per Pipeline configuration",
				LeadUUID: response.lead_uuid!,
				SyncedMessageIds: [],
			},
		};
		const sentBotpressSummary = await this.sendBotpressSummary(
			newState,
			context,
		);
		newState.Data!.SentBotpressSummary = sentBotpressSummary;
		return newState;
	}
	async sync(
		state: RLMIntegrationState,
		context: restate.ObjectSharedContext<SubmittedLeadState<Web2TextLead>>,
	): Promise<RLMIntegrationState> {
		const lead = await context.getAll();
		const twilioIntegration: TwilioIntegrationState | undefined =
			lead.Integrations?.["Twilio"];
		if (twilioIntegration?.SyncStatus !== "SYNCED") {
			return {
				...state,
				SyncStatus: "ERROR",
				ErrorInfo: {
					Message: `Twilio integration is not in correct state 'SYNCED' to sync RLM. Current Twilio state is '${twilioIntegration?.SyncStatus}'`,
					ErrorDate: new Date(await context.date.now()).toISOString(),
				},
			};
		}
		if (!state.Data?.SentBotpressSummary) {
			state.Data!.SentBotpressSummary = await this.sendBotpressSummary(
				state,
				context,
			);
		}

		const conversationSID = twilioIntegration.Data?.ConversationSID!;
		const syncedMessageIds = new Set(state.Data!.SyncedMessageIds);
		const messages = await context.run(
			"Fetching twilio messages for DHQ",
			async () =>
				await this.twilioClient.conversations.v1
					.conversations(conversationSID)
					.messages.list()
					.then((m) => m.map((m) => m.toJSON())),
		);
		for (const message of messages) {
			if (syncedMessageIds.has(message.sid)) continue;
			if (!isValidPhoneNumber(message.author)) continue;
			const result = await context.run(
				"Posting note to RLM",
				async () =>
					await RLMLeadsAPI.AttachNoteToLead(
						new Web2TextMessageIntoRLMNote(state.Data!.LeadUUID, lead, message),
					).catch((e) => ({
						result: "Error",
						Error: serializeError(e),
					})),
			);
			if (result.result === "Success") {
				syncedMessageIds.add(message.sid);
			} else {
				return {
					...state,
					SyncStatus: "ERROR",
					Data: {
						...state.Data!,
						SyncedMessageIds: Array.from(syncedMessageIds),
					},
					ErrorInfo: {
						Message: `Error with RLM note endpoint syncing message '${message.sid}'`,
						Details: {
							message: message,
							response: result,
						},
						ErrorDate: new Date(await context.date.now()).toISOString(),
					},
				};
			}
		}
		return {
			SyncStatus: "SYNCED",
			Data: {
				...state.Data!,
				SyncedMessageIds: Array.from(syncedMessageIds),
			},
			LastSynced: new Date(await context.date.now()).toISOString(),
		};
	}
	async close(
		state: RLMIntegrationState,
		context: restate.ObjectSharedContext<SubmittedLeadState<Web2TextLead>>,
	): Promise<RLMIntegrationState> {
		return {
			...state,
			SyncStatus: "CLOSED",
		};
	}

	private async sendBotpressSummary(
		state: RLMIntegrationState,
		context: restate.ObjectSharedContext<SubmittedLeadState<Web2TextLead>>,
	): Promise<boolean> {
		const lead = await context.getAll();
		if (
			!state.Data?.SentBotpressSummary &&
			lead.Integrations?.["Botpress"]?.SyncStatus === "SYNCED"
		) {
			const botpressConversation = lead.Integrations?.["Botpress"].Data;
			assert(is<BotpressIntegrationState["Data"]>(botpressConversation));
			if (botpressConversation?.Conversation != null) {
				const conversation = botpressConversation.Conversation;
				const date = new Date(await context.date.now()).toISOString();
				const rlmResponse = await context.run(
					"Sending Botpress AI Summary to RLM",
					async () => {
						return await RLMLeadsAPI.AttachNoteToLead({
							lead_uuid: state.Data!.LeadUUID,
							message: `Fibi Chatbot:\n**Topics:** ${conversation.topics?.join(", ") ?? "No topics detected"}\n${conversation.summary}`,
							sender_name: "Dealer",
							sender_phone: "+10000000",
							date: date,
						}).catch((e) => ({
							result: "Error",
							Error: serializeError(e),
						}));
					},
				);
				if (rlmResponse.result === "Success") {
					return true;
				}
			}
		}
		return false;
	}
}
