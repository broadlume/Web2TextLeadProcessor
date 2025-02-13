import type { UUID as UUIDType } from "node:crypto";
import { ExternalIntegrationStateSchema } from "common/external";
import parsePhoneNumber, { type E164Number } from "libphonenumber-js";
import { z } from "zod";

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
	/**
	 * Version of the Web2Text schema
	 * Intended for DB migrations
	 */
	SchemaVersion: z.enum(["1.0.0"]).default("1.0.0"),
	/**
	 * The ID of the Lead
	 */
	LeadId: UUID(),
	/**
	 * The status of the lead
	 * ACTIVE - The lead is active and has been synced to all its integrations
	 * SYNCING - The lead is currently syncing to one or more of its integrations
	 * CLOSED - The lead has been closed and is no longer syncing to its integrations
	 */
	Status: z.enum(["ACTIVE", "SYNCING", "CLOSED"]),
	/**
	 * If the lead is closed, the reason for why it was closed in human readable text
	 */
	CloseReason: z.string().optional(),
	/**
	 * The retailer this lead is associated with
	 */
	UniversalRetailerId: UUID(),
	/**
	 * The location this lead is associated with
	 */
	LocationId: UUID(),
	Lead: z.object({
		/**
		 * The page the customer was on when submitting this lead
		 */
		PageUrl: NonEmptyString().url(),
		/**
		 * The IP address of the customer if it was able to be grabbed
		 */
		IPAddress: NonEmptyString().ip().optional(),
		/**
		 * The name of the customer
		 */
		Name: NonEmptyString(),
		/**
		 * The phone number of the customer
		 */
		PhoneNumber: PhoneNumber(),
		/**
		 * The customer's preferred method of contact
		 */
		PreferredMethodOfContact: z.enum(["phone", "text"]).default("text"),
		/**
		 * The customer's initial message for the dealer
		 */
		CustomerMessage: NonEmptyString(),
		/**
		 * If the customer was looking at a product - the details of that product
		 */
		AssociatedProductInfo: z
			.object({
				Brand: NonEmptyString(),
				Product: NonEmptyString(),
				Variant: NonEmptyString(),
			})
			.optional(),
		/**
		 * The Customer's Google Analytic traffic data at time of submission
		 */
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
	/**
	 * When the lead was submitted
	 */
	DateSubmitted: z.coerce.string().datetime(),
	/**
	 * External integrations to sync this lead to
	 * These are external systems that we can notify and sync leads with
	 */
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
