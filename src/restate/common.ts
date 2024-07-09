import type * as restate from "@restatedev/restate-sdk";
import type { UUID } from "node:crypto";
import { ExternalIntegrationStateSchema, type ExternalIntegrationState } from "../external_integrations";
import { Web2TextLeadSchema, type Web2TextLead } from "../types";
import { version as uuidVersion } from "uuid";
import { z } from "zod";

export const SubmittedLeadStateSchema = z.object({
    LeadId: z.string().uuid(),
    Status: z.enum(["ACTIVE","SYNCING","CLOSED"]),
    SchemaVersion: z.enum(["1.0.0"]),
    Lead: Web2TextLeadSchema,
    DateSubmitted: z.string().datetime(),
    Integrations: z.array(ExternalIntegrationStateSchema)
});

export const LeadStateSchema = z.discriminatedUnion("Status",[
    z.object({
        Status: z.literal("NONEXISTANT")
    }),
    z.object({
        Status: z.literal("VALIDATING"),
        Request: z.unknown()
    }),
    SubmittedLeadStateSchema,
    z.object({
        Status: z.literal("ERROR"),
        Error: z.string(),
        Request: z.unknown()
    })
]);
export type LeadState = z.infer<typeof LeadStateSchema>;
export type SubmittedLeadState = z.infer<typeof SubmittedLeadStateSchema>;

export async function SyncWithDB(
	ctx: restate.ObjectContext,
	direction: "SEND" | "RECEIVE",
) {
}

export function ParseUUID(uuid: unknown): uuid is UUID {
	let version: number;
	try {
		version = uuidVersion(uuid as string);
		if (version !== 4) {
			throw new Error();
		}
	} catch (e) {
		return false;
	}
	return true;
}

export async function GetObjectState(ctx: restate.ObjectSharedContext): Promise<LeadState> {
    const keys = LeadStateSchema.options.flatMap(opt => Object.keys(opt.shape));
    let entries = await Promise.all(keys.map(async k => [k,await ctx.get(k)]));
    if (entries.length === 0) {
       entries = [["Status", "NONEXISTANT"]]; 
    }
    return Object.fromEntries(entries);
}
