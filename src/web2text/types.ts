import type { UUID as UUIDType } from "node:crypto";
import parsePhoneNumber, { type E164Number } from "libphonenumber-js";
import { z } from "zod";
import { ExternalIntegrationStateSchema } from "../common/external";

const NonEmptyString = () =>
	z.string().min(1, { message: "String cannot be empty" });
const UUID = () =>
	NonEmptyString()
		.uuid()
		.refine<UUIDType>((x): x is UUIDType => true);
const PhoneNumber = () =>
	NonEmptyString()
		.transform((x) => parsePhoneNumber(x, "US"))
		.refine((num) => num?.number != null, {
			message: "Invalid phone number",
		})
		.refine((num) => num?.isPossible(), {
			message: "Invalid phone number",
		})
		.transform<E164Number>((num) => num!.number as E164Number);

export const Web2TextLeadSchema = z.object({
	SchemaVersion: z.enum(["1.0.0"]).default("1.0.0"),
	LeadId: UUID(),
	Status: z.enum(["ACTIVE", "SYNCING", "CLOSED"]),
	CloseReason: z.string().optional(),
	UniversalRetailerId: UUID(),
	LocationId: UUID(),
	Lead: z.object({
		PageUrl: NonEmptyString().url(),
		IPAddress: NonEmptyString().ip().optional(),
		Name: NonEmptyString(),
		PhoneNumber: PhoneNumber(),
		PreferredMethodOfContact: z.enum(["phone", "text"]).default("text"),
		CustomerMessage: NonEmptyString(),
		AssociatedProductInfo: z
			.object({
				Brand: NonEmptyString(),
				Product: NonEmptyString(),
				Variant: NonEmptyString(),
			})
			.optional(),
		Traffic: z
			.object({
				Source: z.string().optional(),
				Medium: z.string().optional(),
				Campaign: z.string().optional(),
				Content: z.string().optional(),
				Term: z.string().optional(),
				Type: z.string().optional(),
			})
			.optional(),
	}),
	DateSubmitted: z.coerce.string().datetime(),
	Integrations: z.record(z.string(), ExternalIntegrationStateSchema),
});

export const Web2TextLeadCreateRequestSchema = Web2TextLeadSchema.omit({
	Status: true,
	LeadId: true,
	DateSubmitted: true,
	Integrations: true,
	CloseReason: true,
}).extend({
	SyncImmediately: z.boolean().optional(),
});

export const LeadStateSchema = z.discriminatedUnion("Status", [
	z.object({
		Status: z.literal("NONEXISTANT"),
	}),
	z.object({
		Status: z.literal("VALIDATING"),
		Request: z.unknown(),
	}),
	Web2TextLeadSchema,
	z.object({
		Status: z.literal("ERROR"),
		Error: z.any(),
		Request: z.unknown(),
	}),
]);
export type LeadState = z.infer<typeof LeadStateSchema>;

export type Web2TextLead = z.infer<typeof Web2TextLeadSchema>;
export type Web2TextLeadCreateRequest = z.infer<
	typeof Web2TextLeadCreateRequestSchema
>;
