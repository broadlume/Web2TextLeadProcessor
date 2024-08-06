import * as restate from "@restatedev/restate-sdk";
import { Web2TextLeadSchema } from "../types";
import { z } from "zod";
import { LeadStateModel } from "../dynamodb/LeadStateModel";
import { fromError } from "zod-validation-error";

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
		Error: z.string(),
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
			console.log(parsed);
			const dynamoDBModel = new LeadStateModel(parsed);
			await ctx.run(
				"Sending lead to database",
				async () => await dynamoDBModel.save(),
			);
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
