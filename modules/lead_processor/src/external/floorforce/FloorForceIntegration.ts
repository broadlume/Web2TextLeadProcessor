import type { ObjectSharedContext } from "@restatedev/restate-sdk";
import {
	type ExternalIntegrationState,
	IExternalIntegration,
} from "common/external";
import { serializeError } from "serialize-error";
import { FfWebAPI } from "common/external/floorforce";
import type { SubmittedLeadState } from "#lead";
import type { ActOnLead } from "#lead/acton";

interface FloorForceIntegrationState extends ExternalIntegrationState {
	Data?: {
		LeadId: string;
	};
}

export class FloorForceIntegration
	extends IExternalIntegration<
		SubmittedLeadState<ActOnLead>,
		FloorForceIntegrationState
	>
{
	Name = "FloorForce";
	defaultState(): FloorForceIntegrationState {
		return {
			SyncStatus: "NOT SYNCED",
		};
	}
	async create(
		state: FloorForceIntegrationState,
		context: ObjectSharedContext<SubmittedLeadState<ActOnLead>>,
	): Promise<FloorForceIntegrationState> {
		const leadState = await context.getAll();
		const response = await context.run("Create FloorForce Lead", async () => {
			const res = await FfWebAPI.CreateLead(leadState?.Lead).catch(
				(e) =>
					({
						status: "failure",
						message: serializeError(e),
					}) as FfWebAPI.FfLeadResponse,
			);
			return res;
		});

		if (response.status !== "success") {
			return {
				...state,
				SyncStatus: "ERROR",
				ErrorInfo: {
					Message: "Failed to create FloorForce Lead",
					Details: {
						Response: serializeError(response),
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
		state: FloorForceIntegrationState,
		context: ObjectSharedContext<SubmittedLeadState<ActOnLead>>,
	): Promise<FloorForceIntegrationState> {
		return state;
	}
	async close(
		state: FloorForceIntegrationState,
		context: ObjectSharedContext<SubmittedLeadState<ActOnLead>>,
	): Promise<FloorForceIntegrationState> {
		return state;
	}
}
