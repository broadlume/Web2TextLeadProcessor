import type { UUID } from "node:crypto";
import dynamoose from "dynamoose";
import { Item } from "dynamoose/dist/Item";
import type { ExternalIntegrationState } from "../external/types";
import type { Web2TextLead } from "../types";
import { ENV_PREFIX } from "./Environment";
class LeadStateItem extends Item {
	SchemaVersion!: string;
	LeadId!: string;
	Status!: string;
	UniversalRetailerId!: UUID;
	LocationId!: UUID;
	Lead!: Web2TextLead;
	DateSubmitted!: Date;
	Integrations!: Record<string, ExternalIntegrationState>;
}
const LeadStateModelTableName = `${ENV_PREFIX}_Web2Text_LeadStates`;
const DynamoDBLeadStateSchema = new dynamoose.Schema(
	{
		SchemaVersion: {
			type: String,
			required: true,
		},
		LeadId: {
			type: String,
			required: true,
			hashKey: true,
		},
		Status: {
			type: String,
			required: true,
			enum: ["ACTIVE", "SYNCING", "CLOSED"],
		},
		UniversalRetailerId: {
			type: String,
			required: true,
		},
		LocationId: {
			type: String,
			required: true,
		},
		Lead: {
			type: Object,
			required: true,
		},
		DateSubmitted: {
			type: String,
			required: true,
		},
		Integrations: {
			type: Object,
			required: true,
		},
	},
	{ saveUnknown: true },
);
export const LeadStateModel = dynamoose.model<LeadStateItem>(
	LeadStateModelTableName,
	DynamoDBLeadStateSchema,
);
