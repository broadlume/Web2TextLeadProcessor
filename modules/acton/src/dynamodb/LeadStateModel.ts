import type { UUID } from "node:crypto";
import type { ExternalIntegrationState } from "common/external";
import dynamoose from "dynamoose";
import { Item } from "dynamoose/dist/Item";
import type { WebFormLead } from "../types";
import { ENV_PREFIX } from "./Environment";
class LeadStateItem extends Item {
	SchemaVersion!: string;
	LeadId!: string;
	Status!: string;
	UniversalRetailerId!: UUID;
	LocationId!: UUID;
	Lead!: WebFormLead;
	DateSubmitted!: Date;
	Integrations!: Record<string, ExternalIntegrationState>;
}
const LeadStateModelTableName = `${ENV_PREFIX}_WebLead_LeadStates`;
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
