import * as restate from "@restatedev/restate-sdk";
import { Web2TextLeadSchema } from "../types";
import { z } from "zod";
import { LeadStateModel } from "../dynamodb/LeadStateModel";
import { fromError } from "zod-validation-error";
import { ExternalIntegrationStateSchema } from "../external/types";

export const SubmittedLeadStateSchema = z.object({
    LeadId: z.string().uuid(),
    Status: z.enum(["ACTIVE","SYNCING","CLOSED"]),
    SchemaVersion: z.enum(["1.0.0"]),
    Lead: Web2TextLeadSchema,
    DateSubmitted: z.coerce.string().datetime(),
    Integrations: z.record(z.string(),ExternalIntegrationStateSchema)
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
const a: SubmittedLeadState["Integrations"] = {Twilio: {SyncStatus: "SYNCING"}}

export async function SyncWithDB(
	ctx: restate.ObjectContext,
	direction: "SEND" | "RECEIVE",
) {
    switch (direction) {
        case "SEND": {
                const objectState = await GetObjectState(ctx) as SubmittedLeadState;
                const parsed = SubmittedLeadStateSchema.parse(objectState);
                const dynamoDBModel = new LeadStateModel(parsed);
                await ctx.run("Sending lead to database", async () => await dynamoDBModel.save());
                return true;
        }
        case "RECEIVE": {
                const leadID = ctx.key;
                const lead = await ctx.run("Receiving lead from database", async () => await LeadStateModel.get(leadID));
                ctx.clearAll();
                if (lead == null) {
                    return false;
                }
                const {data,success,error} = await SubmittedLeadStateSchema.safeParseAsync(lead);
                if (!success) {
                    throw new restate.TerminalError(`Could not parse lead ID '${leadID}' from database`, {cause: fromError(error)});
                }
                for (const key of Object.keys(data)) {
                    await ctx.set(key ,data[key as keyof SubmittedLeadState]);
                }
                return true;

        }
    }
}

export async function GetObjectState(ctx: restate.ObjectSharedContext): Promise<LeadState> {
    let keys = LeadStateSchema.options.flatMap(opt => Object.keys(opt.shape));
    const contextKeys = await ctx.stateKeys();
    keys = keys.filter(k => contextKeys.includes(k));
    let entries = await Promise.all(keys.map(async k => [k,await ctx.get(k)]));
    if (entries.length === 0) {
       entries = [["Status", "NONEXISTANT"]]; 
    }
    return Object.fromEntries(entries);
}
