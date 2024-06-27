import { Twilio } from "twilio";
import type { ExternalIntegrationState, IExternalIntegration } from ".";
import type * as restate from '@restatedev/restate-sdk';
import type { SubmittedLeadState } from "../restate/common";

export interface TwilioIntegrationState extends ExternalIntegrationState {
    Data?: {
        ConversationID: string;
        ChatHistory: string[]
    }
};

export class TwilioIntegration implements IExternalIntegration<TwilioIntegrationState> {
    Name = "Twilio";
    defaultState(): TwilioIntegrationState {
        return {
            Name: "Twilio",
            SyncStatus: "NOT SYNCED",
        }
    }
    private twilioClient: Twilio;
    constructor(client?:Twilio) {
        client ??= new Twilio(process.env.TWILIO_ACCOUNT_SID,process.env.TWILIO_AUTH_TOKEN);
        this.twilioClient = client;
    }
	async create(state: TwilioIntegrationState, context: Readonly<SubmittedLeadState>): Promise<TwilioIntegrationState> {
        // const LeadID = context.LeadID;
        // const UniversalClientID = context.Lead.UniversalClientId;
        // const conversation = this.twilioClient.conversations.v1.conversations.create({
        //     attributes: JSON.stringify({
        //         LeadID,
        //         UniversalClientID
        //     }),
        //     friendlyName: "My First Conversation",
        // })
        return {
            ...state,
            SyncStatus: "SYNCED",
            Data: {
                ConversationID: "Test",
                ChatHistory: ["Test1","Test2"]
            },
            LastSynced: new Date().toISOString()
        };
    }
	async sync(state: TwilioIntegrationState, context: Readonly<SubmittedLeadState>): Promise<TwilioIntegrationState> {
        return {
            ...state,
            SyncStatus: "SYNCED",
            Data: {
                ConversationID: "Test",
                ChatHistory: ["Test1","Test2"]
            },
            LastSynced: new Date().toISOString()
        };
	}
}
