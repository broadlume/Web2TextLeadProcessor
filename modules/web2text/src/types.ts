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
	 * The location this lead is associated with
	 */
	LocationId: UUID(),
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
		BotpressConversationId: z.string().optional()
});

export function LeadStateSchema<T extends Record<string, any>, SCHEMA extends z.ZodType<T> = z.ZodType<T>>(leadSchema: SCHEMA) {
	return z.discriminatedUnion("Status", [
		z.object({
			Status: z.literal("NONEXISTANT"),
		}),
		z.object({
			/**
			 * Version of the Web2Text schema
			 * Intended for DB migrations
			 */
			SchemaVersion: z.string().default("2.0.0"),
			/**
			 * The type of lead
			 */
			LeadType: z.enum(["WEB2TEXT"]).default("WEB2TEXT"),
			/**
			 * The status of the lead
			 * ACTIVE - The lead is active and has been synced to all its integrations
			 * SYNCING - The lead is currently syncing to one or more of its integrations
			 * CLOSED - The lead has been closed and is no longer syncing to its integrations
			 */
			Status: z.enum(["ACTIVE", "SYNCING", "CLOSED"]),
			/**
			 * The ID of the Lead
			 */
			LeadId: UUID(),
			/**
			 * If the lead is closed, the reason for why it was closed in human readable text
			 */
			CloseReason: z.string().optional(),
			/**
			 * The retailer this lead is associated with
			 */
			UniversalRetailerId: UUID(),
			/**
			 * The lead data
			 */
			Lead: leadSchema,
			/**
			 * When the lead was submitted
			 */
			DateSubmitted: z.coerce.string().datetime(),
			/**
			 * External integrations to sync this lead to
			 */
			Integrations: z.record(z.string(), ExternalIntegrationStateSchema),
		}),
		z.object({
			Status: z.literal("ERROR"),
			Error: z.any(),
			Request: z.unknown(),
		}).passthrough(),
	]);
}
export type LeadState<T extends Record<string, any>> = z.infer<ReturnType<typeof LeadStateSchema<T>>>;
export type SubmittedLeadState<T extends Record<string, any>> = LeadState<T> & { Status: "ACTIVE" | "SYNCING" | "CLOSED" };
export type ErrorLeadState<T extends Record<string, any>> = LeadState<T> & { Status: "ERROR" };
export type Web2TextLead = z.infer<typeof Web2TextLeadSchema>;
