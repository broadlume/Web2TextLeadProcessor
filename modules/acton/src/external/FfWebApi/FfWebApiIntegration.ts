import { ExternalIntegrationState, IExternalIntegration } from "common/external";
import { LeadState, WebLead } from '../../types';
import { ObjectSharedContext } from "@restatedev/restate-sdk";
import { serializeError } from 'serialize-error';
import { FfWebAPI } from "../../../../common/src/external/floorforce";


interface FfWebApiIntegrationState extends ExternalIntegrationState{
    Data?: {
        LeadId: string;
        SyncedMessageIds: string[];
    }
}

export class FfWebApiIntegration implements IExternalIntegration<
    LeadState, 
    FfWebApiIntegrationState
>{
    Name!: "FFWebApi";
    defaultState() : FfWebApiIntegrationState{
        return {
            SyncStatus: "NOT SYNCED",
        }
    }
    async create(
        state: FfWebApiIntegrationState, 
        context: ObjectSharedContext<WebLead>
    ): Promise<FfWebApiIntegrationState> {
        const leadState = await context.getAll();
        const response = await context.run("Create FfWebApi Lead", async () => {
          await FfWebAPI.CreateLead(leadState?.Lead).catch((e) => (({
            status: "failure",
            Error: serializeError(e),
        }) as FfWebAPI.FfLeadResponse));  
        });
        return {
            ...state,
            SyncStatus: "SYNCED",
            Data: response
        };
    }
    sync(state: FfWebApiIntegrationState, context: ObjectSharedContext<LeadState>): Promise<FfWebApiIntegrationState> {
        throw new Error("Method not implemented.");
    }
    close(state: FfWebApiIntegrationState, context: ObjectSharedContext<LeadState>): Promise<FfWebApiIntegrationState> {
        throw new Error("Method not implemented.");
    }
}

