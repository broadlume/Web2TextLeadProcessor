import * as restate from "@restatedev/restate-sdk";
import { z } from "zod";
import { fromError } from "zod-validation-error";
import { LeadStateModel } from "../dynamodb/LeadStateModel";
import { Web2TextLeadSchema } from "../types";
import { GetRunningEnvironment } from "../util";

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

export async function SyncWithDB(
	ctx: restate.ObjectContext<LeadState>,
	direction: "SEND" | "RECEIVE",
) {
	switch (direction) {
		case "SEND": {
			const objectState = await ctx.getAll();
			const parsed = Web2TextLeadSchema.parse(objectState);
			// For debugging
			if (GetRunningEnvironment().local) {
				ctx.console.log("SYNCED TO DB:", parsed);
			}
			await ctx.run("Sending lead to database", async () => {
				const dynamoDBModel = new LeadStateModel(parsed);
				await dynamoDBModel.save();
			});
			return true;
		}
		case "RECEIVE": {
			const leadID = ctx.key;
			const lead = await ctx.run(
				"Receiving lead from database",
				async () => await LeadStateModel.get(leadID),
			);
			ctx.clearAll();
			if (lead == null) {
				return false;
			}
			const { data, success, error } =
				await Web2TextLeadSchema.safeParseAsync(lead);
			if (!success) {
				throw new restate.TerminalError(
					`Could not parse lead ID '${leadID}' from database`,
					{ cause: fromError(error) },
				);
			}
			await ctx.update((_) => data);
			return true;
		}
	}
}
