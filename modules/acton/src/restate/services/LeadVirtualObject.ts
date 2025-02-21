import type { UUID } from "node:crypto";
import * as restate from "@restatedev/restate-sdk";
import type { ExternalIntegrationState } from "common/external";
import { serializeError } from "serialize-error";
import { assert, is } from "tsafe";
import { z } from "zod";
import { SyncWithDB } from "../../db";
import { WebLeadIntegrations } from "../../external/index";
import type { LeadState } from "../../types";

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

export const LeadVirtualObject = restate.object({
	name: "Lead",
	handlers: {
		status: restate.handlers.object.shared(
			async (
				ctx: restate.ObjectSharedContext<LeadState>,
				req: Record<string, any>,
			) => {
				//await CheckAuthorization(ctx);
				const state = await ctx.getAll();
				return state?.["E-mail Address"];
			},
		),
		create: restate.handlers.object.exclusive(
			async (
				ctx: restate.ObjectContext<LeadState>,
				req: Record<string, any>,
			): Promise<LeadState> => {
				try {
					await ctx.update((_) => ({
						Status: "VALIDATING",
						Request: req ?? {},
					}));
					// Validate the submitted lead
					const Lead = await ParseAndVerifyLeadCreation(ctx, req);

					const currentDate = new Date(await ctx.date.now());
					await ctx.update((_) => ({
						...Lead,
						LeadId: ctx.key as UUID,
						Status: "ACTIVE",
						SchemaVersion: "1.0.0",
						DateSubmitted: currentDate.toISOString(),
						Integrations: {},
					}));
					// Mark the lead as ACTIVE and sync with the database
					ctx.set<LeadState["Status"]>("Status", "ACTIVE");
					await SyncWithDB(ctx, "SEND");
					ctx.console.log(`Created new lead with LeadID: '${ctx.key}'`, {
						_meta: 1,
						Lead: Lead,
					});
				} catch (e) {
					console.log(e);
				}
			},
		),
		sync: restate.handlers.object.exclusive(
			async (
				ctx: restate.ObjectContext<LeadState>,
				req: Record<string, any>,
			): Promise<LeadState> => {
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
					.objectClient(LeadVirtualObject, ctx.key)
					.status({ API_KEY: process.env.INTERNAL_API_TOKEN });
			},
		),
	},
});
