import { z } from "zod";
import parsePhoneNumber, { type E164Number } from "libphonenumber-js";
import type { UUID as UUIDType } from "node:crypto";
import { ExternalIntegrationStateSchema } from "./external/types";

const NonEmptyString = () =>
	z.string().min(1, { message: "String cannot be empty" });
const UUID = () =>
	NonEmptyString()
		.uuid()
		.refine<UUIDType>((x): x is UUIDType => true);
const PhoneNumber = () =>
	NonEmptyString()
		.transform((x) => parsePhoneNumber(x, "US")?.number)
		.refine<E164Number>((num): num is E164Number => num != null, {
			message: "Invalid phone number format",
		});

export const Web2TextLeadSchema = z.object({
    SchemaVersion: z.enum(["1.0.0"]).default("1.0.0"),
	LeadId: UUID(),
	Status: z.enum(["ACTIVE", "SYNCING", "CLOSED"]),
	UniversalClientId: UUID(),
	LocationId: UUID(),
	Lead: z.object({
		PageUrl: NonEmptyString().url(),
		IPAddress: NonEmptyString().ip(),
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
	}),
    DateSubmitted: z.coerce.string().datetime(),
	Integrations: z.record(z.string(), ExternalIntegrationStateSchema)
});

export const Web2TextLeadCreateRequestSchema = Web2TextLeadSchema.omit({Status: true, LeadId: true, DateSubmitted: true, Integrations: true});

export type Web2TextLead = z.infer<typeof Web2TextLeadSchema>;
export type Web2TextLeadCreateRequest = z.infer<
	typeof Web2TextLeadCreateRequestSchema
>;
