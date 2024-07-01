import * as restate from "@restatedev/restate-sdk";
import { type Web2TextLeadRequest, Web2TextLeadRequestSchema } from "../types";
import type { UUID } from "node:crypto";
import { DefaultIntegrationState, type ExternalIntegrationState, Web2TextIntegrations } from "../external_integrations";
import {
	type LeadState,
	ParseUUID,
	type SubmittedLeadState,
	SyncWithDB,
	GetObjectState,
} from "./common";

const HARDCODED_API_KEY = "8695e2fa-3bf7-4949-ba2b-2605ace32b85";
async function ValidateAPIKey(key: UUID): Promise<boolean> {
	return true;
}

async function ValidateIPAddress(ipAddress: string): Promise<boolean> {
	return true;
}

type ClientStatus = "ELIGIBLE" | "INELIGIBLE" | "NONEXISTANT";
async function CheckClientStatus(universalId: UUID): Promise<ClientStatus> {
	return "ELIGIBLE";
}

async function ValidateLocation(location: {
	Name?: string;
	LocationID: UUID;
}): Promise<boolean> {
	return true;
}

async function ParseAndVerify(
	ctx: restate.ObjectContext,
	req: unknown,
): Promise<Web2TextLeadRequest> {
	const parseRequest = await Web2TextLeadRequestSchema.safeParseAsync(req);
	if (!parseRequest.success) {
		const formattedError = parseRequest.error.format();
		const error = {
			message: "Request could not be parsed",
			details: formattedError,
		};
		throw new restate.TerminalError(JSON.stringify(error), {
			errorCode: 400,
		});
	}
	const { APIKey, Lead } = parseRequest.data;
	const apiKeyValid = await ctx.run<boolean>(
		"API key validation",
		async () => await ValidateAPIKey(APIKey),
	);
	if (!apiKeyValid) {
		throw new restate.TerminalError(`API Key '${APIKey}' is invalid`, {
			errorCode: 401,
		});
	}
	const ipAddressValid = await ctx.run<boolean>(
		"IP address validation",
		async () => await ValidateIPAddress(Lead.IPAddress),
	);
	if (!ipAddressValid) {
		throw new restate.TerminalError(
			`IP Address '${Lead}' is invalid or blocked`,
			{ errorCode: 401 },
		);
	}

	const clientStatus = await ctx.run<ClientStatus>(
		"Client status check",
		async () => await CheckClientStatus(Lead.UniversalClientId),
	);
	if (clientStatus !== "ELIGIBLE") {
		throw new restate.TerminalError(
			`UniversalClientID '${Lead.UniversalClientId}' has status '${clientStatus}'`,
			{ errorCode: 400 },
		);
	}

	const locationValid = await ctx.run<boolean>(
		"Location validation",
		async () => await ValidateLocation(Lead.LeadInformation),
	);
	if (!locationValid) {
		throw new restate.TerminalError(
			`LeadInformation.Location {Name: '${Lead.LeadInformation.LocationName}', LocationID: '${Lead.LeadInformation.LocationID}'} is invalid or does not exist'`,
			{ errorCode: 400 },
		);
	}
	return parseRequest.data;
}

async function setup(ctx: restate.ObjectContext, allowedStates: LeadState["Status"][]) {
	if (!ParseUUID(ctx.key)) {
		throw new restate.TerminalError("Lead ID is not a valid UUIDv4", {
			errorCode: 400,
		});
	}
	if (await ctx.get("Status") === "ERROR") {
		ctx.clearAll();
	}
	await SyncWithDB(ctx, "RECEIVE");
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
		status: restate.handlers.object.shared(
			async (ctx: restate.ObjectSharedContext): Promise<LeadState> => {
				const state = await GetObjectState(ctx);
				if (state.Status == null) {
					return {Status: "NONEXISTANT"};
				}
				return state;
			},
		),
		create: restate.handlers.object.exclusive(
			async (ctx: restate.ObjectContext, req: unknown): Promise<LeadState> => {
				await setup(ctx,["NONEXISTANT"]);
				try {
					ctx.set("Request", req);
					ctx.set<LeadState["Status"]>("Status", "VALIDATING");
					const { APIKey, Lead } = await ParseAndVerify(ctx, req);
					ctx.set<SubmittedLeadState["SchemaVersion"]>("SchemaVersion","1.0.0");
					ctx.set<SubmittedLeadState["LeadID"]>("LeadID", ctx.key as UUID);
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
					ctx.set<LeadState["Status"]>("Status", "ACTIVE");
					await SyncWithDB(ctx, "SEND");
				} catch (e) {
					ctx.set("Status", "ERROR");
					ctx.set("Error", (e as Error).message);
					throw e;
				}
				// Schedule syncing the lead
				ctx.objectSendClient(LeadVirtualObject,ctx.key).sync();
				// Return the status of the lead
				return await ctx.objectClient(LeadVirtualObject, ctx.key).status();
			},
		),
		sync: restate.handlers.object.exclusive(async (ctx: restate.ObjectContext): Promise<LeadState> => {
			await setup(ctx,["ACTIVE","SYNCING"]);
			try {
                ctx.set("Status", "SYNCING");
                await SyncWithDB(ctx,"SEND");
				const integrationStates =
					(await ctx.get<SubmittedLeadState["Integrations"]>("Integrations")) ??
					[];
				for (let i = 0; i < integrationStates.length; i++) {
					const state: Readonly<ExternalIntegrationState> =
						integrationStates[i];
					const handler = Web2TextIntegrations.find(
						(i) => i.Name === state.Name,
					);
					if (handler == null) {
						console.warn(
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
							newState = await handler.sync(state,ctx);
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
            ctx.set<LeadState["Status"]>("Status", "ACTIVE");
			return await ctx.objectClient(LeadVirtualObject, ctx.key).status();
		}),
		close: restate.handlers.object.exclusive(async (ctx: restate.ObjectContext): Promise<LeadState> => {
			await setup(ctx,["ACTIVE","CLOSED","SYNCING"]);
			try {
				const integrationStates =
					(await ctx.get<SubmittedLeadState["Integrations"]>("Integrations")) ??
					[];
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
						newState = await handler.close(state,ctx);
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
					ctx.set("Status", "CLOSED");
					await SyncWithDB(ctx, "SEND");
				}
			} catch (e) {
				ctx.set("Status", "ERROR");
				ctx.set("Error", (e as Error).message);
				throw e;
			}
			return await ctx.objectClient(LeadVirtualObject, ctx.key).status();
		})
	},
});
