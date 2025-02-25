import type { ObjectSharedContext } from "@restatedev/restate-sdk";
import type {
	ExternalIntegrationState,
	IExternalIntegration,
} from "common/external";
import { ActOnListAPI } from "../../../../common/src/external/acton";
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
		const leadState = await context.getAll();
		const response = await context.run("Create ActOn Lead", async () => {
			const listId = leadState?.Lead?.listId!;
			delete leadState?.Lead?.listId;

			await ActOnListAPI.CreateContactAPI(listId, leadState?.Lead);
		});
		return {
			...state,
			SyncStatus: "SYNCED",
			Data: response,
		};
	}
	sync(
		state: ActOnIntegrationState,
		context: ObjectSharedContext<LeadState>,
	): Promise<ActOnIntegrationState> {
		throw new Error("Method not implemented.");
	}
	close(
		state: ActOnIntegrationState,
		context: ObjectSharedContext<LeadState>,
	): Promise<ActOnIntegrationState> {
		throw new Error("Method not implemented.");
	}
}
