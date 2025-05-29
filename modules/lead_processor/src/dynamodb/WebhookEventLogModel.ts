import { ENV_PREFIX } from "common";
import dynamoose from "dynamoose";
import type { Item } from "dynamoose/dist/Item";
import type { Event } from "#restate/services/Webhook/WebhookVirtualObject";
type WebhookEventLogItem = Item & Event;
const WebhookEventLogModelTableName = `${ENV_PREFIX}_LeadService_WebhookEventLog`;
const DynamoDBWebhookEventLogSchema = new dynamoose.Schema({
    EventId: {
        type: String,
        hashKey: true,
        required: true,
    },
    SchemaVersion: {
        type: String,
        required: true,
    },
    WebhookType: {
        type: String,
        index: true,
        required: true,
    },
    WebhookId: {
        type: String,
        index: true,
        required: true,
    },
    Payload: {
        type: Object,
        required: true, 
    },
    DateCreated: {
        type: Date,
        required: true,
    },
    NotificationStatus: {
        type: Object,
        required: true,
    },
}
);
export const WebhookEventLogModel = dynamoose.model<WebhookEventLogItem>(
	WebhookEventLogModelTableName,
	DynamoDBWebhookEventLogSchema,
);
