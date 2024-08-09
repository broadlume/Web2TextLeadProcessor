import { RLM_CreateLead, RLM_CreateLeadRequest } from "./LeadsAPI";
import type restate from "@restatedev/restate-sdk";
import { type ExternalIntegrationState, IExternalIntegration } from "../types";
import type { Web2TextLead } from "../../types";
import { Nexus_GetRetailerByID } from "../nexus/RetailerAPI";

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
    async create(state: RLMIntegrationState, context: restate.ObjectSharedContext<Web2TextLead>): Promise<RLMIntegrationState> {
        const leadState = await context.getAll();
        const retailer = await context.run("Fetch Retailer from Nexus", async () => await Nexus_GetRetailerByID(leadState.UniversalClientId));
        if (retailer?.rlm_api_key == null) {
            throw new Error(`RLM API Key doesn't exist for retailer: '${leadState.UniversalClientId}'`);
        } 
        const rlmLead = RLM_CreateLeadRequest(leadState);
        const response = await context.run("Create RLM Lead", async () => await RLM_CreateLead(leadState.LeadId,rlmLead,retailer.rlm_api_key!));
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
    async sync(state: RLMIntegrationState, context: restate.ObjectSharedContext<Web2TextLead>): Promise<RLMIntegrationState> {
        return state;
    }
    async close(state: RLMIntegrationState, context: restate.ObjectSharedContext<Web2TextLead>): Promise<RLMIntegrationState> {
        return state;
    }

}