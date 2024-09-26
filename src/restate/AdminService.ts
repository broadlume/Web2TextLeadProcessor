import * as restate from "@restatedev/restate-sdk";
import { z } from "zod";
import { CheckAuthorization } from "./validators";
import { fromError } from "zod-validation-error";
import { LeadStateModel } from "../dynamodb/LeadStateModel";
import { LeadVirtualObject } from "./LeadVirtualObject";
import { assert, is } from "tsafe";
import type { Scan } from "dynamoose/dist/ItemRetriever";
const NonEmptyObjectSchema = z.object({}).passthrough().refine(obj => Object.keys(obj).length > 0, {
  message: "Object must not be empty",
});

const BulkEndpointRequestSchema = z.object({
	Operation: z.enum(["SYNC", "CLOSE"]),
	Filter: z.union([z.enum(["*"]),NonEmptyObjectSchema]),
	Verbose: z.boolean().optional().default(false)
});
type BulkEndpointResponse = {
	Success: true;
	Count: number;
	LeadIds?: string[];
};
export const AdminService = restate.service({
	name: "Admin",
	handlers: {
		/**
		 * Admin API Endpoint to run bulk operations against many leads in the database
		 */
		bulk: restate.handlers.handler(
			{},
			async (ctx: restate.Context, request: Record<string,string>): Promise<BulkEndpointResponse> => {
				// Validate the API key
				await CheckAuthorization(
					ctx as unknown as restate.ObjectSharedContext,
					ctx.request().headers.get("authorization") ?? request?.["API_KEY"],
				);
				const parsed = await BulkEndpointRequestSchema.safeParse(request);
				if (!parsed.success) {
					const formattedError = fromError(parsed.error);
					throw new restate.TerminalError(
						`Request could not be parsed - ${formattedError.message}`,
						{
							errorCode: 400,
						},
					);
				}
				// If Filter argument is an asterisk, filter for all Leads
				// Otherwise use the filter object fields to filter the leads
				const filter = parsed.data.Filter === "*" ? {} : parsed.data.Filter;
				const leads = await ctx.run(
					"Scan LeadStates in DynamoDB",
					async () => {
						// biome-ignore lint/suspicious/noExplicitAny: <explanation>
						let scan: Scan<any>
						try {
							scan =  LeadStateModel.scan(filter);
						} catch (err) {
							assert(is<Error>(err));
							throw new restate.TerminalError(
								`Error parsing Filter parameter - ${err.message}`,
								{ errorCode: 400, cause: err },
							);
						}
						return await scan.attributes(["LeadId"])
						.all()
						.exec()
						.catch((err) => {
							throw new restate.TerminalError(
								"Error scanning LeadState table",
								{ errorCode: 500, cause: err },
							);
						})
					}

				);
				for (const lead of leads) {
					const leadId = lead.LeadId;
					switch (parsed.data.Operation) {
						case "CLOSE":
							ctx.objectSendClient(LeadVirtualObject, leadId).close({
								reason: "Closed via bulk endpoint",
								API_KEY: process.env.INTERNAL_API_TOKEN,
							});
							break;
						case "SYNC":
							ctx
								.objectSendClient(LeadVirtualObject, leadId)
								.sync({ API_KEY: process.env.INTERNAL_API_TOKEN });
							break;
						default:
							throw new restate.TerminalError(
								`Invalid operation: '${parsed.data.Operation}'`,
							);
					}
				}
				return {
					Success: true,
					Count: leads.length,
					LeadIds: parsed.data.Verbose ? leads.map(l => l.LeadId) : undefined
				}
			},
		),
	},
});
