import type { UUID as UUIDType } from "node:crypto";
import { ExternalIntegrationStateSchema } from "common/external";
import parsePhoneNumber, { type E164Number } from "libphonenumber-js";
import { z } from "zod";
export const LeadTypes = ["WEB2TEXT", "ACTON"] as const;
export type LeadType = (typeof LeadTypes)[number];
export const NonEmptyString = () => z.string().min(1, { message: "String cannot be empty" });
export const UUID = () =>
    NonEmptyString()
        .uuid()
        .refine<UUIDType>((x): x is UUIDType => true);
export const PhoneNumber = () =>
    NonEmptyString()
        .transform((x) => parsePhoneNumber(x, "US"))
        .refine((num) => num?.number != null, {
            message: "Invalid phone number",
        })
        .refine((num) => num?.isPossible(), {
            message: "Invalid phone number",
        })
        .transform<E164Number>((num) => num!.number as E164Number);

export function LeadStateSchema<T extends Record<string, any>, SCHEMA extends z.ZodType<T> = z.ZodType<T>>(
    leadSchema: SCHEMA,
) {
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
            LeadType: z.enum(LeadTypes),
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
        z
            .object({
                Status: z.literal("ERROR"),
                Error: z.any(),
                Request: z.unknown(),
            })
            .passthrough(),
    ]);
}
export type LeadState<T extends Record<string, any>> = z.infer<ReturnType<typeof LeadStateSchema<T>>>;
export type SubmittedLeadState<T extends Record<string, any>> = LeadState<T> & {
    Status: "ACTIVE" | "SYNCING" | "CLOSED";
};
export type ErrorLeadState<T extends Record<string, any>> = LeadState<T> & {
    Status: "ERROR";
};
export type NonValidatedLeadState<T extends Record<string, any>> = Omit<SubmittedLeadState<T>, "Status">;
