import * as restate from "@restatedev/restate-sdk";
import type { UUID } from "node:crypto";
import { Web2TextIntegrations } from "../external";
import { type LeadState, SyncWithDB } from "./common";
import { ParseAndVerifyLeadCreation, ValidateAPIKey } from "./validators";
import { z } from "zod";
import type { ExternalIntegrationState } from "../external/types";
import { assert, is } from "tsafe";
import type { Web2TextLead } from "../types";

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
			Error: (e as Error).message,
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
				_internalToken?: string,
			): Promise<LeadState> => {
				if (
					process.env.INTERNAL_TOKEN == null ||
					_internalToken !== process.env.INTERNAL_TOKEN
				) {
					await ValidateAPIKey(ctx.request().headers.get("authorization"));
				}
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
				req: unknown,
				_internalToken?: string,
			): Promise<LeadState> => {
				// Validate the API key in the authorization header
				if (
					process.env.INTERNAL_TOKEN == null ||
					_internalToken !== process.env.INTERNAL_TOKEN
				) {
					await ValidateAPIKey(ctx.request().headers.get("authorization"));
				}
				// Run pre-handler setup
				await setup(ctx, ["NONEXISTANT"]);
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
				} catch (e) {
					await ctx.update(_ => ({
						Status: "ERROR",
						Error: (e as Error).message
					}));
					throw e;
				}
				// Schedule syncing the lead to external integrations
				ctx
					.objectSendClient(LeadVirtualObject, ctx.key)
					.sync(process.env.INTERNAL_TOKEN);

				// Return the status of the lead
				return await ctx
					.objectClient(LeadVirtualObject, ctx.key)
					.status(process.env.INTERNAL_TOKEN);
			},
		),
		/**
		 * Syncs a lead with external integrations/APIs/services (e.g. Twilio, RLM, DHQ, etc.)
		 */
		sync: restate.handlers.object.exclusive(
			async (
				ctx: restate.ObjectContext<LeadState>,
				_internalToken?: string,
			): Promise<LeadState> => {
				// Validate the API key in the authorization header
				if (
					process.env.INTERNAL_TOKEN == null ||
					_internalToken !== process.env.INTERNAL_TOKEN
				) {
					await ValidateAPIKey(ctx.request().headers.get("authorization"));
				}
				// Run pre-handler setup
				await setup(ctx, ["ACTIVE", "SYNCING"]);
				try {
					assert(is<restate.ObjectContext<Web2TextLead>>(ctx));
					// Update the state of the lead to SYNCING
					ctx.set("Status", "SYNCING");
					await SyncWithDB(ctx, "SEND");
					// Iterate through all integrations and call their create/sync handlers
					const integrations = Web2TextIntegrations;
					const integrationStates =
						(await ctx.get(
							"Integrations",
						)) ?? {};
					for (const integration of integrations) {
						const state =
							integrationStates[integration.Name] ?? integration.defaultState();
						const shouldRunCreate = state.SyncStatus === "NOT SYNCED";
						state.SyncStatus = "SYNCING";
						integrationStates[integration.Name] = state;
						ctx.set("Integrations", integrationStates);
						await SyncWithDB(ctx, "SEND");
						let newState: ExternalIntegrationState;
						try {
							if (shouldRunCreate) {
								newState = await integration.create(state, ctx);
							} else {
								newState = await integration.sync(state, ctx);
							}
						} catch (e) {
							newState = {
								...state,
								SyncStatus: "ERROR",
								Info: {
									Message: "An error occurred during sync",
									Details: `${e}`,
								},
							};
						}
						integrationStates[integration.Name] = newState;
						ctx.set("Integrations", integrationStates);
						await SyncWithDB(ctx, "SEND");
					}
				} catch (e) {
					await ctx.update((_) => ({
						Status: "ERROR",
						Error: (e as Error).message
					}));
					throw e;
				}
				// Re-mark the lead status as ACTIVE and sync with the database after sync finishes
				ctx.set<LeadState["Status"]>("Status", "ACTIVE");
				await SyncWithDB(ctx, "SEND");

				// Return the status of the lead
				return await ctx
					.objectClient(LeadVirtualObject, ctx.key)
					.status(process.env.INTERNAL_TOKEN);
			},
		),
		/**
		 * Marks the lead as closed - which disallows any further syncing or updating - and tell external integrations about it
		 */
		close: restate.handlers.object.exclusive(
			async (
				ctx: restate.ObjectContext<LeadState>,
				_internalToken?: string,
			): Promise<LeadState> => {
				// Validate the API key in the authorization header
				if (
					process.env.INTERNAL_TOKEN == null ||
					_internalToken !== process.env.INTERNAL_TOKEN
				) {
					await ValidateAPIKey(ctx.request().headers.get("authorization"));
				}
				// Run pre-handler setup
				await setup(ctx, ["ACTIVE", "CLOSED", "SYNCING"]);
				try {
					assert(is<restate.ObjectContext<Web2TextLead>>(ctx));
					// Iterate through all integrations and call their close handlers
					const integrations = Web2TextIntegrations;
					const integrationStates =
						(await ctx.get(
							"Integrations",
						)) ?? {};
					for (const integration of integrations) {
						const state =
							integrationStates[integration.Name] ?? integration.defaultState();
						integrationStates[integration.Name] = state;
						ctx.set("Integrations", integrationStates);
						await SyncWithDB(ctx, "SEND");
						let newState: ExternalIntegrationState;
						try {
							newState = await integration.close(state, ctx);
						} catch (e) {
							newState = {
								...state,
								SyncStatus: "ERROR",
								Info: {
									Message: "An error occurred during close",
									Details: `${e}`,
								},
							};
						}
						integrationStates[integration.Name] = newState;
						ctx.set("Integrations", integrationStates);
						await SyncWithDB(ctx, "SEND");
					}
					// Mark the lead status as CLOSED and sync with the database
					ctx.set<LeadState["Status"]>("Status", "CLOSED");
					await SyncWithDB(ctx, "SEND");
				} catch (e) {
					await ctx.update(_ => ({
						Status: "ERROR",
						Error: (e as Error).message
					}));
					throw e;
				}
				// Return the status of the lead
				return await ctx
					.objectClient(LeadVirtualObject, ctx.key)
					.status(process.env.INTERNAL_TOKEN);
			},
		),
	},
});
