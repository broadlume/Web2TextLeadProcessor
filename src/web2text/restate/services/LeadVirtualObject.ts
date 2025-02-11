import type { UUID } from "node:crypto";
import * as restate from "@restatedev/restate-sdk";
import { serializeError } from "serialize-error";
import { assert, is } from "tsafe";
import { z } from "zod";
import type { ExternalIntegrationState } from "@common/external";
import type { LeadState, Web2TextLead } from "../../types";
import { SyncWithDB } from "../db";
import { CheckAuthorization, ParseAndVerifyLeadCreation } from "../validators";
import { Web2TextIntegrations } from "web2text/external";

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
		/**
		 * Endpoint that returns the status of a lead and all of its state
		 */
		status: restate.handlers.object.shared(
			async (
				ctx: restate.ObjectSharedContext<LeadState>,
				req?: Record<string, any>,
			): Promise<LeadState> => {
				// Validate the API key
				await CheckAuthorization(
					ctx as unknown as restate.ObjectSharedContext,
					`${LeadVirtualObject.name}/status`,
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
				// Validate the API key
				await CheckAuthorization(
					ctx as unknown as restate.ObjectSharedContext,
					`${LeadVirtualObject.name}/create`,
					ctx.request().headers.get("authorization") ?? req?.["API_KEY"],
				);
				// Boolean flag for whether or not we should schedule a sync for the lead immediately after creation
				let ShouldRunSync = false;
				// Run pre-handler setup
				await setup(ctx, ["NONEXISTANT"]);
				try {
					await ctx.update((_) => ({
						Status: "VALIDATING",
						Request: req ?? {},
					}));
					// Validate the submitted lead
					const Lead = await ParseAndVerifyLeadCreation(ctx, req);
					ShouldRunSync = Lead.SyncImmediately ?? true;
					delete Lead.SyncImmediately;

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
					ctx.console.log(`Created new lead with LeadID: '${ctx.key}'`, {_meta:1, Lead: Lead});
				} catch (e) {
					await ctx.update((state) => ({
						...state,
						Status: "ERROR",
						Error: serializeError(e),
					}));
					throw e;
				}
				if (ShouldRunSync) {
					// Schedule syncing the lead to external integrations
					ctx
						.objectSendClient(LeadVirtualObject, ctx.key)
						.sync({ API_KEY: process.env.INTERNAL_API_TOKEN });
				}
				// Return the status of the lead
				return await ctx
					.objectClient(LeadVirtualObject, ctx.key)
					.status({ API_KEY: process.env.INTERNAL_API_TOKEN });
			},
		),
		/**
		 * Syncs a lead with external integrations/APIs/services (e.g. Twilio, RLM, DHQ, etc.)
		 */
		sync: restate.handlers.object.exclusive(
			async (
				ctx: restate.ObjectContext<LeadState>,
				req?: Record<string, any>,
			): Promise<LeadState> => {
				// Validate the API key
				await CheckAuthorization(
					ctx as unknown as restate.ObjectSharedContext,
					`${LeadVirtualObject.name}/sync`,
					ctx.request().headers.get("authorization") ?? req?.["API_KEY"],
				);
				// Run pre-handler setup
				await setup(ctx, ["ACTIVE", "SYNCING"]);
				ctx.console.log(`Starting 'sync' for Lead ID: '${ctx.key}'`);
				assert(is<restate.ObjectContext<Web2TextLead>>(ctx));
				// Update the state of the lead to SYNCING
				ctx.set("Status", "SYNCING");
				await SyncWithDB(ctx, "SEND");
				// Iterate through all integrations and call their create/sync handlers
				const integrations = Web2TextIntegrations;
				const integrationStates = (await ctx.get("Integrations")) ?? {};

				// Run create/sync method on each integration
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
						} else {
							ctx.console.info(
								`Executing 'sync' for external integration '${integration.Name}'`,
								{
									_meta: 1,
									Integration: integration.Name,
									CurrentSyncState: state,
								},
							);
							newState = await integration.sync(state, ctx);
							ctx.console.info(
								`Finished 'sync' for external integration '${integration.Name}' with status: '${newState.SyncStatus}'`,
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
						const operation = shouldRunCreate ? "create" : "sync";
						ctx.console.warn(
							`Error executing '${operation}' for external integration '${integration.Name}'`,
							{
								_meta: 1,
								Integration: integration.Name,
								OldSyncState: state,
								CurrentSyncState: newState,
							},
						);
					}
					// Delete Error info if there is no error
					if (newState.SyncStatus !== "ERROR") {
						delete newState.ErrorInfo;
					}
					integrationStates[integration.Name] = newState;
					ctx.set("Integrations", integrationStates);
					await SyncWithDB(ctx, "SEND");
				}
				// Re-mark the lead status as ACTIVE and sync with the database after sync finishes
				ctx.set<LeadState["Status"]>("Status", "ACTIVE");
				await SyncWithDB(ctx, "SEND");
				ctx.console.log(`Finished 'sync' for Lead ID: '${ctx.key}'`);

				// Return the status of the lead
				return await ctx
					.objectClient(LeadVirtualObject, ctx.key)
					.status({ API_KEY: process.env.INTERNAL_API_TOKEN });
			},
		),
		/**
		 * Marks the lead as closed - which disallows any further syncing or updating - and tell external integrations about it
		 */
		close: restate.handlers.object.exclusive(
			async (
				ctx: restate.ObjectContext<LeadState>,
				req?: { reason?: string; API_KEY?: string },
			): Promise<LeadState> => {
				// Validate the API key
				await CheckAuthorization(
					ctx as unknown as restate.ObjectSharedContext,
					`${LeadVirtualObject.name}/close`,
					ctx.request().headers.get("authorization") ?? req?.["API_KEY"],
				);
				// Run pre-handler setup
				await setup(ctx, ["ACTIVE", "SYNCING", "CLOSED"]);
				assert(is<restate.ObjectContext<Web2TextLead>>(ctx));
				ctx.console.log(`Starting 'close' for Lead ID: '${ctx.key}'`);
				// Iterate through all integrations and call their close handlers
				const integrations = Web2TextIntegrations;
				const integrationStates = (await ctx.get("Integrations")) ?? {};
				// Only set the close reason if it wasn't set already
				const closeReason =
					(await ctx.get("CloseReason")) ?? req?.reason ?? "Not specified";
				ctx.set("CloseReason", closeReason);
				for (const integration of integrations) {
					// Set the default state if it doesn't exist
					integrationStates[integration.Name] ??= integration.defaultState();
					const state = integrationStates[integration.Name];
					if (
						state.SyncStatus === "CLOSED" ||
						state.SyncStatus === "NOT SYNCED"
					)
						continue;
					let newState: ExternalIntegrationState;
					try {
						ctx.console.info(
							`Executing 'close' for external integration '${integration.Name}'`,
							{
								_meta: 1,
								Integration: integration.Name,
								CurrentSyncState: state,
							},
						);
						newState = await integration.close(state, ctx);
						ctx.console.info(
							`Finished 'close' for external integration '${integration.Name}' with status '${newState.SyncStatus}'`,
							{
								_meta: 1,
								Integration: integration.Name,
								OldSyncState: state,
								CurrentSyncState: newState,
							},
						);
					} catch (e) {
						assert(is<Error>(e));
						newState = {
							...state,
							SyncStatus: "ERROR",
							ErrorInfo: {
								Message: "An error occurred during close",
								Details: serializeError(e),
								ErrorDate: new Date(await ctx.date.now()).toISOString(),
							},
						};
						ctx.console.warn(
							`Error executing 'close' for external integration '${integration.Name}'`,
							{
								_meta: 1,
								Integration: integration.Name,
								OldSyncState: state,
								CurrentSyncState: newState,
							},
						);
					}
					// Delete Error info if there is no error
					if (newState.SyncStatus !== "ERROR") {
						delete newState.ErrorInfo;
					}
					integrationStates[integration.Name] = newState;
					ctx.set("Integrations", integrationStates);
					await SyncWithDB(ctx, "SEND");
				}
				// Mark the lead status as CLOSED and sync with the database
				ctx.set("Status", "CLOSED");
				await SyncWithDB(ctx, "SEND");
				ctx.console.log(`Finished 'close' for Lead ID: '${ctx.key}'`);
				// Return the status of the lead
				return await ctx
					.objectClient(LeadVirtualObject, ctx.key)
					.status({ API_KEY: process.env.INTERNAL_API_TOKEN });
			},
		),
	},
});
