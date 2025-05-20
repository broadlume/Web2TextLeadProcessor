import type { UUID } from "node:crypto";
import { ENV_PREFIX } from "common";
import type { ExternalIntegrationState } from "common/external";
import dynamoose from "dynamoose";
import { Item } from "dynamoose/dist/Item";
import type { Web2TextLead } from "../types";
class LeadStateItem extends Item {
	SchemaVersion!: string;
	LeadId!: string;
	LeadType!: string;
	Status!: string;
	UniversalRetailerId!: UUID;
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
		LeadType: {
			type: String,
			required: true,
			default: "WEB2TEXT",
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
