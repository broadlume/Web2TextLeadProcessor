import type { ObjectSharedContext } from "@restatedev/restate-sdk";
import type { Web2TextLead } from "../../types";
import { type ExternalIntegrationState, IExternalIntegration } from "../types";
import { Twilio } from "twilio";
import { StoresAPI } from "../nexus";
import * as StoreInquiryAPI from "./StoreInquiryAPI";
interface DHQIntegrationState extends ExternalIntegrationState {
    Data?: {
        InquiryId: string;
        SyncedMessageIds: string[];
    }
} 

export class DHQIntegration extends IExternalIntegration<DHQIntegrationState> {
    Name = "DHQ";
    defaultState(): DHQIntegrationState {
        return {
            SyncStatus: "NOT SYNCED"
        }
    }
    private twilioClient: Twilio;
    public constructor(client?: Twilio) {
        super();
        client ??= new Twilio(
			process.env.TWILIO_ACCOUNT_SID,
			process.env.TWILIO_AUTH_TOKEN,
		);
		this.twilioClient = client;
    }
    async create(state: DHQIntegrationState, context: ObjectSharedContext<Web2TextLead>): Promise<DHQIntegrationState> {
        const leadState = await context.getAll();
        const store = await context.run("Fetch Store from Nexus", async () => await StoresAPI.GetRetailerStoreByID(leadState.LocationId));
        if (store === null) {
            return {
                ...state,
                SyncStatus: "ERROR",
                Info: {
                    Message: `Store '${leadState.LocationId}' does not exist in Nexus API`
                }
            }
        }
        const response = await context.run("Create DHQ Lead", async () => await StoreInquiryAPI.SubmitStoreInquiry(leadState,store));
        if (response.status !== "success") {
            throw new Error(`Got error response from RLM API for lead: '${leadState.LeadId}'`, {cause: response});
        }
        
        return {
            ...state,
            SyncStatus: "SYNCED",
            LastSynced: new Date(await context.date.now()).toISOString(),
            Data: {
                InquiryId: response.data!.store_inquiry.Id,
                SyncedMessageIds: []
            }
        }
    }
    async sync(state: DHQIntegrationState, context: ObjectSharedContext<Web2TextLead>): Promise<DHQIntegrationState> {
        return state;
    }
    async close(state: DHQIntegrationState, context: ObjectSharedContext<Web2TextLead>): Promise<DHQIntegrationState> {
        return state;
    }

}