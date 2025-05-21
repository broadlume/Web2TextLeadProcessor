import * as restate from "@restatedev/restate-sdk";
import { GetRunningEnvironment } from "common";
import { fromError } from "zod-validation-error";
import { LeadStateModel } from "#dynamodb/LeadStateModel";
import { type LeadState, LeadStateSchema, type LeadType } from "#lead/schema";
import { Web2TextLeadSchema } from "#lead/web2text";
import { LeadTypeInfo } from "./services/Lead/LeadTypes";

export async function SyncWithDB(
	ctx: restate.ObjectContext<LeadState<Record<string,any>>>,
	direction: "SEND" | "RECEIVE",
) {
	ctx.console.debug(
		`Begin DynamoDB lead state sync with direction: ${direction}`,
		{ _meta: 1 },
	);
	let synced = false;
	switch (direction) {
		case "SEND": {
			const objectState = await ctx.getAll();
			const leadTypeInfo = LeadTypeInfo[(objectState as any).LeadType as LeadType];
			const parsed = LeadStateSchema(leadTypeInfo.schema).parse(objectState);
			// For debugging
			if (GetRunningEnvironment().local) {
				ctx.console.debug("SYNCED TO DB:", parsed);
			}
			await ctx.run("Sending lead to database", async () => {
				const dynamoDBModel = new LeadStateModel(parsed);
				await dynamoDBModel.save();
			});
			synced = true;
			break;
		}
		case "RECEIVE": {
			const leadID = ctx.key;
			const lead = await ctx.run(
				"Receiving lead from database",
				async () => await LeadStateModel.get(leadID),
			);
			ctx.clearAll();
			if (lead == null) {
				synced = false;
				break;
			}
			const leadTypeInfo = LeadTypeInfo[(lead as any).LeadType as LeadType];
			const { data, success, error } =
				await LeadStateSchema(leadTypeInfo.schema).safeParseAsync(lead);
			if (!success) {
				throw new restate.TerminalError(
					`Could not parse lead ID '${leadID}' from database`,
					{ cause: fromError(error) },
				);
			}
			await ctx.update((_) => data);
			synced = true;
			break;
		}
	}
	ctx.console.debug(
		`End DynamoDB lead state sync with direction: ${direction}`,
		{ _meta: 1, Success: synced },
	);
	return synced;
}
