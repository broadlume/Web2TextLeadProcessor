import type { UUID } from "node:crypto";
import * as restate from "@restatedev/restate-sdk";
import type { ExternalIntegrationState } from "common/external";
import { Authorization } from "common/restate";
import { serializeError } from "serialize-error";
import { assert, is } from "tsafe";
import { z } from "zod";
import { fromError } from "zod-validation-error";
import { SyncWithDB } from "../../db";
import { WebLeadIntegrations } from "../../external/index";
import {
	type LeadState,
	type WebFormLead,
	WebFormLeadCreateRequestSchema,
	type WebLead,
} from "../../types";

/**
 * Helper function that runs before all of our exclusive handlers
 * Handles initializing state from the database verifying assumptions
 * @param ctx the restate Object context
 * @param allowedStates a set of lead status states that we should allow this handler to run with
 */
async function setup(
	ctx: restate.ObjectContext<LeadState>,
	allowedStates: LeadState["Status"][],
) {
	const uuidParser = z.string().uuid();
	if (!uuidParser.safeParse(ctx.key).success) {
		throw new restate.TerminalError("Lead ID is not a valid UUIDv4", {
			errorCode: 400,
		});
	}
	if ((await ctx.get("Status")) === "ERROR") {
		ctx.clearAll();
	}
	try {
		await SyncWithDB(ctx, "RECEIVE");
	} catch (e) {
		await ctx.update((_) => ({
			Status: "ERROR",
			Error: serializeError(e),
		}));
		throw e;
	}

	const status = (await ctx.get("Status")) ?? "NONEXISTANT";
	const canRun = allowedStates.includes(status);
	if (!canRun) {
		throw new restate.TerminalError(
			`Lead ID '${ctx.key}' doesn't exist or is in incorrect status '${status}'`,
			{ errorCode: 409 },
		);
	}
}

export const WebLeadVirtualObject = restate.object({
	name: "WebLead",
	handlers: {
		status: restate.handlers.object.shared(
			async (
				ctx: restate.ObjectSharedContext<LeadState>,
				req: Record<string, any>,
			): Promise<LeadState> => {
				await Authorization.CheckAuthorization(
					ctx as unknown as restate.ObjectSharedContext,
					`${WebLeadVirtualObject.name}/status`,
					ctx.request().headers.get("authorization") ?? req?.["API_KEY"],
				);
				const state = await ctx.getAll();
				if (state.Status == null) {
					return { Status: "NONEXISTANT" };
				}
				return state;
			},
		),
		/**
		 * Creates a new lead in the database
		 */
		create: restate.handlers.object.exclusive(
			async (
				ctx: restate.ObjectContext<LeadState>,
				req: Record<string, any>,
			): Promise<LeadState> => {
				await Authorization.CheckAuthorization(
					ctx as unknown as restate.ObjectSharedContext,
					`${WebLeadVirtualObject.name}/create`,
					ctx.request().headers.get("authorization") ?? req?.["API_KEY"],
				);
				await setup(ctx, ["NONEXISTANT"]);
				try {
					await ctx.update((_) => ({
						Status: "VALIDATING",
						Request: req ?? {},
					}));
					// Validate the submitted lead
					const parsedRequest = WebFormLeadCreateRequestSchema.safeParse(req);
					if (!parsedRequest?.success) {
						const formattedError = fromError(parsedRequest.error);
						throw new restate.TerminalError(
							`Request could not be parsed - ${formattedError.message}`,
							{
								errorCode: 400,
							},
						);
					}
					const Lead = parsedRequest.data as WebFormLead;
					const currentDate = new Date(await ctx.date.now());
					await ctx.update((_) => ({
						LeadId: ctx.key as UUID,
						Status: "ACTIVE",
						SchemaVersion: "1.0.0",
						DateSubmitted: currentDate.toISOString(),
						Integrations: {},
						Lead: Lead,
						UniversalRetailerId: ctx.key as UUID,
					}));
					// Mark the lead as ACTIVE and sync with the database
					ctx.set<LeadState["Status"]>("Status", "ACTIVE");
					await SyncWithDB(ctx, "SEND");
					ctx.console.log(`Created new lead with LeadID: '${ctx.key}'`);
				} catch (e) {
					console.log(e);
				}
				// Return the status of the lead
				return await ctx
					.objectClient(WebLeadVirtualObject, ctx.key)
					.status({ API_KEY: process.env.INTERNAL_API_TOKEN });
			},
		),
		sync: restate.handlers.object.exclusive(
			async (
				ctx: restate.ObjectContext<LeadState>,
				req: Record<string, any>,
			): Promise<LeadState> => {
				await Authorization.CheckAuthorization(
					ctx as unknown as restate.ObjectSharedContext,
					`${WebLeadVirtualObject.name}/sync`,
					ctx.request().headers.get("authorization") ?? req?.["API_KEY"],
				);
				// Run pre-handler setup
				await setup(ctx, ["ACTIVE", "SYNCING"]);
				ctx.console.log(`Starting 'sync' for Lead ID : '${ctx.key}'`);
				assert(is<restate.ObjectContext<WebLead>>(ctx));
				ctx.set("Status", "SYNCING");
				await SyncWithDB(ctx, "SEND");

				const integrations = WebLeadIntegrations;
				const integrationStates = (await ctx.get("Integrations")) ?? {};

				for (const integration of integrations) {
					// Set the default state if it doesn't exist
					integrationStates[integration.Name] ??= integration.defaultState();
					const state = integrationStates[integration.Name];
					// Don't sync closed integration
					if (state.SyncStatus === "CLOSED") continue;
					const shouldRunCreate =
						state.SyncStatus === "NOT SYNCED" ||
						(state.SyncStatus === "ERROR" && state.LastSynced == null);
					let newState: ExternalIntegrationState;
					try {
						if (shouldRunCreate) {
							ctx.console.info(
								`Executing 'create' for external integration '${integration.Name}'`,
								{
									_meta: 1,
									Integration: integration.Name,
									CurrentSyncState: state,
								},
							);
							newState = await integration.create(state, ctx);
							ctx.console.info(
								`Finished 'create' for external integration '${integration.Name}' with status: '${newState.SyncStatus}'`,
								{
									_meta: 1,
									Integration: integration.Name,
									OldSyncState: state,
									CurrentSyncState: newState,
								},
							);
						}
					} catch (e) {
						assert(is<Error>(e));
						newState = {
							...state,
							SyncStatus: "ERROR",
							ErrorInfo: {
								Message: "An error occurred during sync",
								Details: serializeError(e),
								ErrorDate: new Date(await ctx.date.now()).toISOString(),
							},
						};
					}
				}
				return await ctx
					.objectClient(WebLeadVirtualObject, ctx.key)
					.status({ API_KEY: process.env.INTERNAL_API_TOKEN });
			},
		),
	},
});
