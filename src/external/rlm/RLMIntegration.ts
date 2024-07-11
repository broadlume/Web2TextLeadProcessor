import type { ObjectSharedContext } from "@restatedev/restate-sdk";
import { GetObjectState, type SubmittedLeadState } from "../../restate/common";
import { RLM_CreateLead, RLM_CreateLeadRequest } from "./LeadsAPI";
import { type ExternalIntegrationState, IExternalIntegration } from "../types";

export interface RLMIntegrationState extends ExternalIntegrationState {
    Data?: {
        LeadId: number,
        SyncedMessageIds: string[]
    }
}

export class RLMIntegration extends IExternalIntegration<RLMIntegrationState> {
    Name = "RLM";
    defaultState(): RLMIntegrationState {
        return {
            SyncStatus: "NOT SYNCED",
        }
    }
    async create(state: RLMIntegrationState, context: ObjectSharedContext): Promise<RLMIntegrationState> {
        const leadState = await GetObjectState(context) as SubmittedLeadState;
        const rlmLead = RLM_CreateLeadRequest(leadState);
        const response = await context.run("Create RLM Lead", async () => await RLM_CreateLead(leadState.LeadId,rlmLead,"4eb5038bcba07abbc5c43937bd462c8c"));
        if (response.result !== "Success") {
            throw new Error(`Got error response from RLM API for lead: '${leadState.LeadId}'`, {cause: response});
        }
        
        return {
            ...state,
            SyncStatus: "SYNCED",
            LastSynced: new Date(await context.date.now()).toISOString(),
            Data: {
                LeadId: response.lead_id,
                SyncedMessageIds: []
            }
        }
    }
    async sync(state: RLMIntegrationState, context: ObjectSharedContext): Promise<RLMIntegrationState> {
        return state;
    }
    async close(state: RLMIntegrationState, context: ObjectSharedContext): Promise<RLMIntegrationState> {
        return state;
    }

}