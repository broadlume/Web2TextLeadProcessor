import * as restate from "@restatedev/restate-sdk";
import type { Scan } from "dynamoose/dist/ItemRetriever";
import { assert, is } from "tsafe";
import { z } from "zod";
import { fromError } from "zod-validation-error";
import { LeadStateModel } from "../../dynamodb/LeadStateModel";
import type { Web2TextLead } from "../../types";
import { LeadVirtualObject } from "./LeadVirtualObject";
import { CheckAuthorization } from "../validators";
import { serializeError } from "serialize-error";
const NonEmptyObjectSchema = z
	.object({})
	.passthrough()
	.refine((obj) => Object.keys(obj).length > 0, {
		message: "Object must not be empty",
	});

const BulkEndpointRequestSchema = z.discriminatedUnion("Operation", [
	z.object({
		Operation: z.enum(["SYNC", "CLOSE", "FIND"]),
		Reason: z.string().optional(),
		Filter: z.union([z.enum(["*"]), NonEmptyObjectSchema]),
		Verbose: z.boolean().optional().default(false),
		Async: z.boolean().optional().default(true),
	}),
]);
type BulkEndpointResponse = {
	Count: number;
	Result?: any[];
};
export const AdminService = restate.service({
	name: "Admin",
	handlers: {
		/**
		 * Admin API Endpoint to run bulk operations against many leads in the database
		 */
		bulk: restate.handlers.handler(
			{},
			async (
				ctx: restate.Context,
				request: Record<string, string>,
			): Promise<BulkEndpointResponse> => {
				const parsed = BulkEndpointRequestSchema.safeParse(request);
				if (!parsed.success) {
					const formattedError = fromError(parsed.error);
					throw new restate.TerminalError(
						`Request could not be parsed - ${formattedError.message}`,
						{
							errorCode: 400,
						},
					);
				}
				// Validate the API key
				await CheckAuthorization(
					ctx as unknown as restate.ObjectSharedContext,
					`${AdminService.name}/bulk/${parsed.data.Operation}`,
					ctx.request().headers.get("authorization") ?? request?.["API_KEY"],
				);
				// If Filter argument is an asterisk, filter for all Leads
				// Otherwise use the filter object fields to filter the leads
				const filter = parsed.data.Filter === "*" ? {} : parsed.data.Filter;
				const leads: Web2TextLead[] = (await ctx.run(
					"Scan LeadStates in DynamoDB",
					async () => {
						let scan: Scan<any>;
						try {
							scan = LeadStateModel.scan(filter);
						} catch (err) {
							assert(is<Error>(err));
							throw new restate.TerminalError(
								`Error parsing Filter parameter - ${err.message}`,
								{ errorCode: 400, cause: err },
							);
						}
						if (!parsed.data.Verbose) {
							scan = scan.attributes(["LeadId"]);
						}
						return await scan
							.all()
							.exec()
							.catch((err) => {
								throw new restate.TerminalError(
									"Error scanning LeadState table",
									{ errorCode: 500, cause: err },
								);
							});
					},
				)) as Web2TextLead[];
				let result: any[] = [];
				switch (parsed.data.Operation) {
					case "CLOSE": {
						if (parsed.data.Async === true) {
							for (const lead of leads) {
								ctx.objectSendClient(LeadVirtualObject, lead.LeadId).close({
									reason: parsed.data.Reason ?? "Closed by Administrator",
									API_KEY: process.env.INTERNAL_API_TOKEN,
								});
							}
							result = leads.map((l) => (parsed.data.Verbose ? l : l.LeadId));
						} else {
							const results: any[] =
								await restate.CombineablePromise.allSettled(
									leads.map((lead) =>
										ctx.objectClient(LeadVirtualObject, lead.LeadId).close({
											reason: parsed.data.Reason ?? "Closed by Administrator",
											API_KEY: process.env.INTERNAL_API_TOKEN,
										}),
									),
								);
							for (let i = 0; i < leads.length; i++) {
								if (!("LeadId" in results[i])) {
									results[i] = {
										LeadId: leads[i].LeadId,
										Error: { ...serializeError(results[i]), stack: undefined },
									};
								}
							}
							result = parsed.data.Verbose
								? results
								: leads.map((l) => l.LeadId);
						}
						break;
					}
					case "SYNC": {
						if (parsed.data.Async === true) {
							for (const lead of leads) {
								ctx.objectSendClient(LeadVirtualObject, lead.LeadId).sync({
									API_KEY: process.env.INTERNAL_API_TOKEN,
								});
							}
							result = leads.map((l) => (parsed.data.Verbose ? l : l.LeadId));
						} else {
							const results: any[] =
								await restate.CombineablePromise.allSettled(
									leads.map((lead) =>
										ctx.objectClient(LeadVirtualObject, lead.LeadId).sync({
											API_KEY: process.env.INTERNAL_API_TOKEN,
										}),
									),
								);
							for (let i = 0; i < leads.length; i++) {
								if (!("LeadId" in results[i])) {
									results[i] = {
										LeadId: leads[i].LeadId,
										Error: { ...serializeError(results[i]), stack: undefined },
									};
								}
							}
							result = parsed.data.Verbose
								? results
								: leads.map((l) => l.LeadId);
						}
						break;
					}
					case "FIND": {
						result = parsed.data.Verbose ? leads : leads.map((l) => l.LeadId);
						break;
					}
					default:
						throw new restate.TerminalError(
							`Invalid operation: '${parsed.data.Operation}'`,
						);
				}
				ctx.console.log(
					`Executed admin bulk operation '${parsed.data.Operation}' over ${leads.length} leads`,
					{
						_meta: 1,
						...parsed.data,
						LeadCount: leads.length,
						Result: result,
					},
				);
				return {
					Count: leads.length,
					Result: result,
				};
			},
		),
	},
});
