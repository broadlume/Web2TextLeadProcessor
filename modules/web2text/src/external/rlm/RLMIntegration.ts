import type * as restate from "@restatedev/restate-sdk";
import {
	type ExternalIntegrationState,
	IExternalIntegration,
} from "common/external";
import { NexusRetailerAPI } from "common/external/nexus";
import { RLMLeadsAPI } from "common/external/rlm";
import { isValidPhoneNumber } from "libphonenumber-js";
import { serializeError } from "serialize-error";
import type { Twilio } from "twilio";
import type { LeadState, Web2TextLead } from "../../types";
import type { TwilioIntegrationState } from "../twilio/TwilioIntegration";
import {
	Web2TextLeadIntoRLMLead,
	Web2TextMessageIntoRLMNote,
} from "./APIConverters";

export interface RLMIntegrationState extends ExternalIntegrationState {
	Data?: {
		LeadId: number;
		LeadUUID: string;
		SyncedMessageIds: string[];
	};
}

export class RLMIntegration extends IExternalIntegration<
	LeadState,
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
	async create(
		state: RLMIntegrationState,
		context: restate.ObjectSharedContext<Web2TextLead>,
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
		const response = await context.run(
			"Create RLM Lead",
			async () =>
				await RLMLeadsAPI.CreateLead(
					leadState.LeadId,
					new Web2TextLeadIntoRLMLead(leadState),
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

		return {
			...state,
			SyncStatus: "SYNCED",
			LastSynced: new Date(await context.date.now()).toISOString(),
			Data: {
				LeadId: response.lead_id,
				LeadUUID: response.lead_uuid!,
				SyncedMessageIds: [],
			},
		};
	}
	async sync(
		state: RLMIntegrationState,
		context: restate.ObjectSharedContext<Web2TextLead>,
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
		context: restate.ObjectSharedContext<Web2TextLead>,
	): Promise<RLMIntegrationState> {
		return {
			...state,
			SyncStatus: "CLOSED",
		};
	}
}
