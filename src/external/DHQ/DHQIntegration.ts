import type { ObjectSharedContext } from "@restatedev/restate-sdk";
import { isValidPhoneNumber } from "libphonenumber-js";
import { serializeError } from "serialize-error";
import { Twilio } from "twilio";
import { DHQStoreInquiryAPI } from ".";
import type { Web2TextLead } from "../../types";
import { NexusStoresAPI } from "../nexus";
import type { TwilioIntegrationState } from "../twilio/TwilioIntegration";
import { type ExternalIntegrationState, IExternalIntegration } from "../types";
import * as StoreInquiryAPI from "./DHQStoreInquiryAPI";
interface DHQIntegrationState extends ExternalIntegrationState {
	Data?: {
		LeadId: string;
		SyncedMessageIds: string[];
	};
}
export class DHQIntegration extends IExternalIntegration<DHQIntegrationState> {
	Name = "DHQ";
	defaultState(): DHQIntegrationState {
		return {
			SyncStatus: "NOT SYNCED",
		};
	}
	private twilioClient: Twilio;
	public constructor(client?: Twilio) {
		super();
		client ??= new Twilio(
			process.env.TWILIO_ACCOUNT_SID,
			process.env.TWILIO_AUTH_TOKEN,
		);
		this.twilioClient = client;
	}
	async create(
		state: DHQIntegrationState,
		context: ObjectSharedContext<Web2TextLead>,
	): Promise<DHQIntegrationState> {
		const leadState = await context.getAll();
		const store = await context.run(
			"Fetch Store from Nexus",
			async () =>
				await NexusStoresAPI.GetRetailerStoreByID(leadState.LocationId),
		);
		if (store === null) {
			return {
				...state,
				SyncStatus: "ERROR",
				ErrorInfo: {
					Message: `Store '${leadState.LocationId}' does not exist in Nexus API`,
					ErrorDate: new Date(await context.date.now()).toISOString(),
				},
			};
		}
		const response = await context.run(
			"Create DHQ Lead",
			async () =>
				await StoreInquiryAPI.SubmitStoreInquiry(leadState, store).catch(
					(e) =>
						({
							status: "failure",
							Error: serializeError(e),
						}) as StoreInquiryAPI.StoreInquiryResponse,
				),
		);
		if (response.status !== "success") {
			return {
				...state,
				SyncStatus: "ERROR",
				ErrorInfo: {
					Message: "Error with DHQ lead submit endpoint",
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
				LeadId: response.data!.lead.id,
				SyncedMessageIds: [],
			},
		};
	}
	async sync(
		state: DHQIntegrationState,
		context: ObjectSharedContext<Web2TextLead>,
	): Promise<DHQIntegrationState> {
		const lead = await context.getAll();
		const twilioIntegration: TwilioIntegrationState | undefined =
			lead.Integrations?.["Twilio"];
		if (twilioIntegration?.SyncStatus !== "SYNCED") {
			return {
				...state,
				SyncStatus: "ERROR",
				ErrorInfo: {
					Message: `Twilio integration is not in correct state 'SYNCED' to sync DHQ. Current Twilio state is '${twilioIntegration?.SyncStatus}'`,
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
				"Posting comment to DHQ",
				async () =>
					await DHQStoreInquiryAPI.AddCommentToInquiry(
						state.Data!.LeadId,
						lead,
						message,
					).catch((e) => ({
						status: "failure",
						Error: serializeError(e),
					})),
			);
			if (result.status === "success") {
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
						Message: `Error with DHQ comment endpoint syncing message '${message.sid}'`,
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
		state: DHQIntegrationState,
		context: ObjectSharedContext<Web2TextLead>,
	): Promise<DHQIntegrationState> {
		return {
			...state,
			SyncStatus: "CLOSED",
		};
	}
}
