import dynamoose from "dynamoose";
import { Item } from "dynamoose/dist/Item";
import type { SubmittedLeadState } from "../restate/common";
import type { ExternalIntegrationState } from "../external";
class LeadStateItem extends Item {
    LeadId!: string;
    Status!: string;
    SchemaVersion!: string;
    Lead!: SubmittedLeadState;
    DateSubmitted!: Date;
    Integrations!: ExternalIntegrationState[];
}
const DynamoDBLeadStateSchema = new dynamoose.Schema({
    LeadId: {
        type: String,
        required: true,
        hashKey: true
    },
    Status: {
        type: String,
        required: true,
        enum: ["ACTIVE","SYNCING","CLOSED"]
    },
    SchemaVersion: {
        type: String,
        required: true
    },
    Lead: {
        type: Object,
        required: true
    },
    DateSubmitted: {
        type: String,
        required: true
    },
    Integrations: {
        type: Array,
        schema: [Object],
        required: true
    },
}, {saveUnknown: true});
export const LeadStateModel = dynamoose.model<LeadStateItem>("Web2Text_LeadStates", DynamoDBLeadStateSchema);