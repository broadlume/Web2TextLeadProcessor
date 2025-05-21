import type { SubmittedLeadState } from "#lead";
import type { ActOnLead } from "#lead/acton";
import type { ObjectSharedContext } from "@restatedev/restate-sdk";
import {
	type ExternalIntegrationState,
	IExternalIntegration,
} from "common/external";
import { ActOnListAPI } from "common/external/acton";
import { serializeError } from "serialize-error";

interface ActOnIntegrationState extends ExternalIntegrationState {
	Data?: {
		LeadId: string;
	};
}

export class ActOnIntegration
	extends IExternalIntegration<SubmittedLeadState<ActOnLead>, ActOnIntegrationState>
{
	Name = "ActOn";
	defaultState(): ActOnIntegrationState {
		return {
			SyncStatus: "NOT SYNCED",
		};
	}
	async create(
		state: ActOnIntegrationState,
		context: ObjectSharedContext<SubmittedLeadState<ActOnLead>>,
	): Promise<ActOnIntegrationState> {
		const leadState = await context.getAll();

		const listId = leadState?.Lead?.Lead?.listId!;
		delete leadState?.Lead?.Lead?.listId;
		const ActOnRes = await ActOnListAPI.CreateContactAPI(
			listId,
			leadState?.Lead?.Lead,
		).catch(
			(e) =>
				({
					status: "failure",
					message: e,
				}) as ActOnListAPI.ActOnResponse,
		);

		if (ActOnRes?.status !== "success") {
			return {
				...state,
				SyncStatus: "ERROR",
				ErrorInfo: {
					Message: "Failed to create ActOn Lead",
					Details: {
						Response: serializeError(ActOnRes),
					},
					ErrorDate: new Date(await context.date.now()).toISOString(),
				},
			};
		}
		return {
			...state,
			SyncStatus: "SYNCED",
		};
	}
	async sync(
		state: ActOnIntegrationState,
		context: ObjectSharedContext<SubmittedLeadState<ActOnLead>>,
	): Promise<ActOnIntegrationState> {
		return state;
	}
	async close(
		state: ActOnIntegrationState,
		context: ObjectSharedContext<SubmittedLeadState<ActOnLead>>,
	): Promise<ActOnIntegrationState> {
		return state;
	}
}
