import * as restate from "@restatedev/restate-sdk";
import type { UUID } from "node:crypto";
import {
	DefaultIntegrationState,
	type ExternalIntegrationState,
	Web2TextIntegrations,
} from "../external";
import {
	type LeadState,
	type SubmittedLeadState,
	SyncWithDB,
	GetObjectState,
} from "./common";
import { ParseAndVerifyLeadCreation, ValidateAPIKey } from "./validators";
import { z } from "zod";

/**
 * Helper function that runs before all of our exclusive handlers
 * Handles initializing state from the database verifying assumptions
 * @param ctx the restate Object context
 * @param allowedStates a set of lead status states that we should allow this handler to run with
 */
async function setup(
	ctx: restate.ObjectContext,
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
		ctx.set("Status", "ERROR");
		ctx.set("Error", (e as Error).message);
		throw e;
	}

	const status =
		(await ctx.get<LeadState["Status"]>("Status")) ?? "NONEXISTANT";
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
				ctx: restate.ObjectSharedContext,
				_internalToken?: string,
			): Promise<LeadState> => {
				if (_internalToken !== process.env.INTERNAL_TOKEN) {
					await ValidateAPIKey(ctx.request().headers.get("authorization"));
				}
				const state = await GetObjectState(ctx);
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
				ctx: restate.ObjectContext,
				req: unknown,
				_internalToken?: string,
			): Promise<LeadState> => {
				// Validate the API key in the authorization header
				if (_internalToken !== process.env.INTERNAL_TOKEN) {
					await ValidateAPIKey(ctx.request().headers.get("authorization"));
				}
				// Run pre-handler setup
				await setup(ctx, ["NONEXISTANT"]);
				try {
					ctx.set("Request", req);
					ctx.set<LeadState["Status"]>("Status", "VALIDATING");
					// Validate the submitted lead
					const { Lead } = await ParseAndVerifyLeadCreation(ctx, req);

					ctx.set<SubmittedLeadState["SchemaVersion"]>(
						"SchemaVersion",
						"1.0.0",
					);
					ctx.set<SubmittedLeadState["LeadId"]>("LeadId", ctx.key as UUID);
					ctx.set<SubmittedLeadState["Lead"]>("Lead", Lead);
					const currentDate = new Date(await ctx.date.now());
					ctx.set<SubmittedLeadState["DateSubmitted"]>(
						"DateSubmitted",
						currentDate.toISOString(),
					);
					ctx.set<SubmittedLeadState["Integrations"]>(
						"Integrations",
						DefaultIntegrationState(Web2TextIntegrations),
					);
					ctx.clear("Request");

					// Mark the lead as ACTIVE and sync with the database
					ctx.set<LeadState["Status"]>("Status", "ACTIVE");
					await SyncWithDB(ctx, "SEND");
				} catch (e) {
					ctx.set("Status", "ERROR");
					ctx.set("Error", (e as Error).message);
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
				ctx: restate.ObjectContext,
				_internalToken?: string,
			): Promise<LeadState> => {
				// Validate the API key in the authorization header
				if (_internalToken !== process.env.INTERNAL_TOKEN) {
					await ValidateAPIKey(ctx.request().headers.get("authorization"));
				}
				// Run pre-handler setup
				await setup(ctx, ["ACTIVE", "SYNCING"]);
				try {
					// Update the state of the lead to SYNCING
					ctx.set("Status", "SYNCING");
					await SyncWithDB(ctx, "SEND");

					// Iterate through all integrations and call their create/sync handlers
					const integrationStates =
						(await ctx.get<SubmittedLeadState["Integrations"]>(
							"Integrations",
						)) ?? [];
					for (let i = 0; i < integrationStates.length; i++) {
						const state: Readonly<ExternalIntegrationState> =
							integrationStates[i];
						const handler = Web2TextIntegrations.find(
							(i) => i.Name === state.Name,
						);
						if (handler == null) {
							ctx.console.warn(
								`Unknown integration found in lead '${ctx.key}': '${state.Name}' - skipping sync`,
							);
							continue;
						}
						const shouldRunCreate = state.SyncStatus === "NOT SYNCED";
						integrationStates[i].SyncStatus = "SYNCING";
						ctx.set("Integrations", integrationStates);
						await SyncWithDB(ctx, "SEND");
						let newState: ExternalIntegrationState;
						try {
							if (shouldRunCreate) {
								newState = await handler.create(state, ctx);
							} else {
								newState = await handler.sync(state, ctx);
							}
						} catch (e) {
							newState = {
								...state,
								SyncStatus: "ERROR",
								Error: {
									Message: "An error occurred during sync",
									Details: `${e}`,
								},
							};
						}
						integrationStates[i] = newState;
						ctx.set("Integrations", integrationStates);
						await SyncWithDB(ctx, "SEND");
					}
				} catch (e) {
					ctx.set("Status", "ERROR");
					ctx.set("Error", (e as Error).message);
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
				ctx: restate.ObjectContext,
				_internalToken?: string,
			): Promise<LeadState> => {
				// Validate the API key in the authorization header
				if (_internalToken !== process.env.INTERNAL_TOKEN) {
					await ValidateAPIKey(ctx.request().headers.get("authorization"));
				}
				// Run pre-handler setup
				await setup(ctx, ["ACTIVE", "CLOSED", "SYNCING"]);
				try {
					// Iterate through all integrations and call their close handlers
					const integrationStates =
						(await ctx.get<SubmittedLeadState["Integrations"]>(
							"Integrations",
						)) ?? [];
					for (let i = 0; i < integrationStates.length; i++) {
						const state: Readonly<ExternalIntegrationState> =
							integrationStates[i];
						const handler = Web2TextIntegrations.find(
							(i) => i.Name === state.Name,
						);
						if (handler == null) {
							console.warn(
								`Unknown integration found in lead '${ctx.key}': '${state.Name}' - skipping close`,
							);
							continue;
						}
						let newState: ExternalIntegrationState;
						try {
							newState = await handler.close(state, ctx);
						} catch (e) {
							newState = {
								...state,
								SyncStatus: "ERROR",
								Error: {
									Message: "An error occurred during close",
									Details: `${e}`,
								},
							};
						}
						integrationStates[i] = newState;
						ctx.set("Integrations", integrationStates);
						// Mark the lead status as CLOSED and sync with the database
						ctx.set("Status", "CLOSED");
						await SyncWithDB(ctx, "SEND");
					}
				} catch (e) {
					ctx.set("Status", "ERROR");
					ctx.set("Error", (e as Error).message);
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
