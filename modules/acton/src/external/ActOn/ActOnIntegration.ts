import type { ObjectSharedContext } from "@restatedev/restate-sdk";
import type { IExternalIntegration } from "common/external";
import { FfWebAPI } from "../../../../common/src/external/floorforce";
import type { LeadState, WebLead } from "../../types";
import { WebFormLeadIntoFf } from "./ApiConverters";

type ActOnIntegrationState = {
	SyncStatus: "NOT SYNCED" | "SYNCING" | "SYNCED" | "ERROR" | "CLOSED";
	Data?: any;
	LastSynced?: string | undefined;
	ErrorInfo?:
		| {
				Message: string;
				Details?: any;
				ErrorDate?: string | undefined;
		  }
		| undefined;
};

export class ActOnIntegration
	implements IExternalIntegration<LeadState, ActOnIntegrationState>
{
	Name: "ActOn";
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
			await FfWebAPI.CreateLead(leadState.Lead);
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
