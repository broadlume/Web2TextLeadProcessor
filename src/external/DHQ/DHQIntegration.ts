import type { ObjectSharedContext } from "@restatedev/restate-sdk";
import type { Web2TextLead } from "../../types";
import { type ExternalIntegrationState, IExternalIntegration } from "../types";
import { Twilio } from "twilio";
import { NexusStoresAPI } from "../nexus";
import * as StoreInquiryAPI from "./DHQStoreInquiryAPI";
import { isValidPhoneNumber } from "libphonenumber-js";
import type { TwilioIntegrationState } from "../twilio/TwilioIntegration";
import { DHQStoreInquiryAPI } from ".";
interface DHQIntegrationState extends ExternalIntegrationState {
    Data?: {
        LeadId: string;
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
        const store = await context.run("Fetch Store from Nexus", async () => await NexusStoresAPI.GetRetailerStoreByID(leadState.LocationId));
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
                LeadId: response.data!.lead.id,
                SyncedMessageIds: []
            }
        }
    }
    async sync(state: DHQIntegrationState, context: ObjectSharedContext<Web2TextLead>): Promise<DHQIntegrationState> {
        const lead = await context.getAll();
        const twilioIntegration: TwilioIntegrationState | undefined = lead.Integrations?.["Twilio"];
        if (twilioIntegration?.SyncStatus !== "SYNCED") {
            return {
                ...state,
                SyncStatus: "ERROR",
                Info: {
                    Message: `Twilio integration is not in correct state 'SYNCED' to sync DHQ. Current Twilio state is '${twilioIntegration?.SyncStatus}'`
                }
            }
        }
        
        const conversationSID = twilioIntegration.Data?.ConversationSID!;
        const conversation = await context.run(
			"Fetching Twilio conversation for DHQ",
			async () =>
				this.twilioClient.conversations.v1
					.conversations(conversationSID)
					.fetch(),
		);
        const syncedMessageIds = new Set(state.Data!.SyncedMessageIds);
        const messages = await context.run("Fetching twilio messages for DHQ", async () => await conversation.messages().list());
        for (const message of messages) {
            if (syncedMessageIds.has(message.sid)) continue;
            if (!isValidPhoneNumber(message.author)) continue;
            const result = await context.run("Posting comment to DHQ", async () => await DHQStoreInquiryAPI.AddCommentToInquiry(state.Data!.LeadId, lead, message));
            if (result.status === "success") {
                syncedMessageIds.add(message.sid);
            }
            else {
                return {
                    ...state,
                    SyncStatus: "ERROR",
                    Data: {
                        ...state.Data!,
                        SyncedMessageIds: Array.from(syncedMessageIds)
                    },
                    Info: {
                        Message: `Error with DHQ comment endpoint syncing message '${message.sid}'`,
                        Details: {
                            message: message.toJSON(),
                            response: result
                        }
                    }
                }
            }
        }
        return {
            SyncStatus: "SYNCED",
            Data: {
                ...state.Data!,
                SyncedMessageIds: Array.from(syncedMessageIds)
            },
            LastSynced: new Date(await context.date.now()).toISOString()
        }
    }
    async close(state: DHQIntegrationState, context: ObjectSharedContext<Web2TextLead>): Promise<DHQIntegrationState> {
        return {
            ...state,
            SyncStatus: "CLOSED"
        };
    }

}