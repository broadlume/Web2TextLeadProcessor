import { z } from "zod";
import { Web2TextLeadSchema } from "#lead/web2text";
import { ActOnLeadSchema } from "#lead/acton";
import { UUID } from "#lead";

export const LeadCreateRequestSchema = z.discriminatedUnion("LeadType", [
    z.object({
        SchemaVersion: z.string().default("2.0.0"),
        LeadType: z.literal("WEB2TEXT"),
        UniversalRetailerId: UUID(),
        Lead: Web2TextLeadSchema,
        SyncImmediately: z.boolean().optional(),
    }),
    z.object({
        SchemaVersion: z.string().default("2.0.0"),
        LeadType: z.literal("ACTON"),
        UniversalRetailerId: UUID(),
        Lead: ActOnLeadSchema,
        SyncImmediately: z.boolean().optional(),
    })
])
    
export type LeadCreateRequest = z.infer<
	typeof LeadCreateRequestSchema
>;
