import { IExternalIntegration } from "common/external";
import { LeadState } from "../../types";
import { ObjectSharedContext } from "@restatedev/restate-sdk";
import { serializeError } from 'serialize-error';

type FfWebApiIntegrationState = {
    SyncStatus: "NOT SYNCED" | "SYNCING" | "SYNCED" | "ERROR" | "CLOSED";
    Data?: any;
    LastSynced?: string | undefined;
    ErrorInfo?: {
        Message: string;
        Details?: any;
        ErrorDate?: string | undefined;
    } | undefined;
}

export class FfWebApiIntegration implements IExternalIntegration<
    LeadState, 
    FfWebApiIntegrationState
>{
    Name: "FFWebApi";
    defaultState() : FfWebApiIntegrationState{
        return {
            SyncStatus: "NOT SYNCED",
        }
    }
    async create(
        state: FfWebApiIntegrationState, 
        context: ObjectSharedContext<LeadState>
    ): Promise<FfWebApiIntegrationState> {
        const leadState = await context.getAll();
        const response = await context.run("Create FfWebApi Lead", async () => {
          await FfWebAPI.CreateLead({}).catch((e) => (({
            status: "failure",
            Error: serializeError(e),
        }) as FfWebAPI.StoreInquiryResponse));  
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

