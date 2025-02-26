import type { ObjectSharedContext } from "@restatedev/restate-sdk";
import * as restate from "@restatedev/restate-sdk";
import type {
	ExternalIntegrationState,
	IExternalIntegration,
} from "common/external";
import { ActOnListAPI } from "../../../../common/src/external/acton";
import type { ActOnResponse } from "../../../../common/src/external/acton/ActOnListAPI";
import type { LeadState, WebLead } from "../../types";

interface ActOnIntegrationState extends ExternalIntegrationState {
	Data?: {
		LeadId: string;
	};
}

export class ActOnIntegration
	implements IExternalIntegration<LeadState, ActOnIntegrationState>
{
	Name!: "ActOn";
	defaultState(): ActOnIntegrationState {
		return {
			SyncStatus: "NOT SYNCED",
		};
	}
	async create(
		state: ActOnIntegrationState,
		context: ObjectSharedContext<WebLead>,
	): Promise<ActOnIntegrationState> {
		context.console.log(`Starting 'create' for ActOn Integration`);
		const leadState = await context.getAll();
		const response = await context.run("Create ActOn Lead", async () => {
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
					}) as ActOnResponse,
			);
			return ActOnRes;
		});
		if (response?.status !== "success") {
			return {
				...state,
				SyncStatus: "ERROR",
				ErrorInfo: {
					Message: response.message,
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
		state: ActOnIntegrationState,
		context: ObjectSharedContext<LeadState>,
	): Promise<ActOnIntegrationState> {
		throw new restate.TerminalError("Lead Syncing not allowed.", {
			errorCode: 400,
		});
	}
	close(
		state: ActOnIntegrationState,
		context: ObjectSharedContext<LeadState>,
	): Promise<ActOnIntegrationState> {
		throw new restate.TerminalError("Lead Closing not allowed.", {
			errorCode: 400,
		});
	}
}
