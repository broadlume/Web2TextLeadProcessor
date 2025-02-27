import type { ObjectSharedContext } from "@restatedev/restate-sdk";
import * as restate from "@restatedev/restate-sdk";
import type {
	ExternalIntegrationState,
	IExternalIntegration,
} from "common/external";
import { serializeError } from "serialize-error";
import { FfWebAPI } from "../../../../common/src/external/floorforce";
import type { FfLeadResponse } from "../../../../common/src/external/floorforce/FfWebAPI";
import type { LeadState, WebLead } from "../../types";

interface FfWebApiIntegrationState extends ExternalIntegrationState {
	Data?: {
		LeadId: string;
	};
}

export class FfWebApiIntegration
	implements IExternalIntegration<LeadState, FfWebApiIntegrationState>
{
	Name!: "FFWebApi";
	defaultState(): FfWebApiIntegrationState {
		return {
			SyncStatus: "NOT SYNCED",
		};
	}
	async create(
		state: FfWebApiIntegrationState,
		context: ObjectSharedContext<WebLead>,
	): Promise<FfWebApiIntegrationState> {
		context.console.log(`Starting 'create' for FFWebApi Integration`);
		const leadState = await context.getAll();
		const response = await context.run("Create FfWebApi Lead", async () => {
			const res = await FfWebAPI.CreateLead(leadState?.Lead?.Lead).catch(
				(e) =>
					({
						status: "failure",
						message: serializeError(e),
					}) as FfLeadResponse,
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
	sync(
		state: FfWebApiIntegrationState,
		context: ObjectSharedContext<LeadState>,
	): Promise<FfWebApiIntegrationState> {
		throw new restate.TerminalError("FloorForce Lead Syncing not allowed.", {
			errorCode: 400,
		});
	}
	close(
		state: FfWebApiIntegrationState,
		context: ObjectSharedContext<LeadState>,
	): Promise<FfWebApiIntegrationState> {
		throw new restate.TerminalError("FloorForce Lead Closing not allowed.", {
			errorCode: 400,
		});
	}
}
