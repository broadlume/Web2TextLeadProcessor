import type { UUID as UUIDType } from "node:crypto";
import { ExternalIntegrationStateSchema } from "common/external";
import z from "zod";

const NonEmptyString = () =>
	z.string().min(1, { message: "String cannot be empty" });
const UUID = () =>
	NonEmptyString()
		.uuid()
		.refine<UUIDType>((x): x is UUIDType => true);
export const WebFormLeadSchema = z.record(z.string(), z.any());

export const ActOnLeadSchema = z.object({
	SchemaVersion: z.enum(["1.0.0"]).default("1.0.0"),
	LeadId: UUID(),
	Lead: z.record(z.string(), z.any()),
	Status: z.enum(["ACTIVE", "SYNCING", "CLOSED"]),
	UniversalRetailerId: UUID(),
	DateSubmitted: z.coerce.string().datetime(),
	Integrations: z.record(z.string(), ExternalIntegrationStateSchema),
});

export const WebFormLeadCreateRequestSchema = ActOnLeadSchema.omit({
	Status: true,
	LeadId: true,
	DateSubmitted: true,
	Integrations: true,
});

const LeadStateSchema = z.discriminatedUnion("Status", [
	z.object({
		Status: z.literal("NONEXISTANT"),
	}),
	z.object({
		Status: z.literal("VALIDATING"),
		Request: z.unknown(),
	}),
	ActOnLeadSchema,
	z.object({
		Status: z.literal("ERROR"),
		Error: z.any(),
		Request: z.unknown(),
	}),
]);

export type LeadState = z.infer<typeof LeadStateSchema>;

export type WebLead = z.infer<typeof ActOnLeadSchema>;

export type WebFormLead = z.infer<typeof WebFormLeadSchema>;
