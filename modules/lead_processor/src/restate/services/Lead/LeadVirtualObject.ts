import type { UUID } from "node:crypto";
import * as restate from "@restatedev/restate-sdk";
import { ValidationErrorMsg } from "common";
import type { ExternalIntegrationState } from "common/external";
import { Authorization } from "common/restate";
import { serializeError } from "serialize-error";
import { assert, is } from "tsafe";
import { z } from "zod";
import { fromError } from "zod-validation-error";
import type { ErrorLeadState, LeadState, SubmittedLeadState } from "#lead/schema";
import { SyncWithDB } from "#restate/db";
import { LeadCreateRequestSchema } from "./LeadCreateRequest";
import { LeadTypeInfo } from "./LeadTypes";

type State = LeadState<Record<string, any>>;
type SubmittedState = SubmittedLeadState<Record<string, any>>;
type ErrorState = ErrorLeadState<Record<string, any>>;
/**
 * Helper function that runs before all of our exclusive handlers
 * Handles initializing state from the database verifying assumptions
 * @param ctx the restate Object context
 * @param allowedStates a set of lead status states that we should allow this handler to run with
 */
async function setup(ctx: restate.ObjectContext<State>, allowedStates: State["Status"][]) {
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
        throw new restate.TerminalError(`Lead ID '${ctx.key}' doesn't exist or is in incorrect status '${status}'`, {
            errorCode: 409,
        });
    }
}

export const LeadVirtualObject = restate.object({
    name: "Lead",
    handlers: {
        /**
         * Endpoint that returns the status of a lead and all of its state
         */
        status: restate.handlers.object.shared(
            async (ctx: restate.ObjectSharedContext<State>, req?: Record<string, any>): Promise<State> => {
                // Validate the API key
                await Authorization.CheckAuthorization(
                    ctx as unknown as restate.ObjectSharedContext,
                    `${LeadVirtualObject.name}/status`,
                    ctx.request().headers.get("authorization"),
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
                ctx: restate.ObjectContext<State>,
                req: Record<string, any>,
            ): Promise<SubmittedState | ErrorState> => {
                // Validate the API key
                await Authorization.CheckAuthorization(
                    ctx as unknown as restate.ObjectSharedContext,
                    `${LeadVirtualObject.name}/create`,
                    ctx.request().headers.get("authorization"),
                );
                // Boolean flag for whether or not we should schedule a sync for the lead immediately after creation
                let ShouldRunSync = false;
                // Run pre-handler setup
                await setup(ctx, ["NONEXISTANT"]);
                try {
                    // Parse the request
                    const leadCreateRequest = await LeadCreateRequestSchema.safeParseAsync(req);

                    if (!leadCreateRequest.success) {
                        const formattedError = fromError(leadCreateRequest.error);
                        throw new restate.TerminalError(`Request could not be parsed - ${formattedError.message}`, {
                            errorCode: 400,
                        });
                    }
                    const leadType = leadCreateRequest.data.LeadType;
                    const leadTypeInfo = LeadTypeInfo[leadType];
                    // Validate the submitted lead
                    const validator = new leadTypeInfo.validator(ctx as unknown as restate.ObjectSharedContext);
                    const validationStatus = await validator.validate(leadCreateRequest.data);
                    if (validationStatus.Status !== "VALID") {
                        throw new restate.TerminalError(
                            ValidationErrorMsg("Lead validation failed", validationStatus, true),
                            {
                                errorCode: 400,
                            },
                        );
                    }
                    const Lead = leadCreateRequest.data;
                    ShouldRunSync = Lead.SyncImmediately ?? true;
                    delete Lead.SyncImmediately;

                    const currentDate = new Date(await ctx.date.now());
                    await ctx.update((_) => ({
                        ...Lead,
                        LeadId: ctx.key as UUID,
                        Status: "ACTIVE",
                        SchemaVersion: "2.0.0",
                        DateSubmitted: currentDate.toISOString(),
                        Integrations: {},
                    }));
                    // Mark the lead as ACTIVE and sync with the database
                    ctx.set<State["Status"]>("Status", "ACTIVE");
                    await SyncWithDB(ctx, "SEND");
                    ctx.console.log(`Created new lead with LeadID: '${ctx.key}'`, {
                        _meta: 1,
                        label: leadType,
                        Lead: Lead,
                    });
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
                    ctx.objectSendClient(LeadVirtualObject, ctx.key).sync(
                        {},
                        restate.rpc.sendOpts({
                            headers: {
                                authorization: process.env.INTERNAL_API_TOKEN!,
                            },
                        }),
                    );
                }
                // Return the status of the lead
                return (await ctx.objectClient(LeadVirtualObject, ctx.key).status(
                    {},
                    restate.rpc.opts({
                        headers: {
                            authorization: process.env.INTERNAL_API_TOKEN!,
                        },
                    }),
                )) as SubmittedState;
            },
        ),
        /**
         * Syncs a lead with external integrations/APIs/services (e.g. Twilio, RLM, DHQ, etc.)
         */
        sync: restate.handlers.object.exclusive(
            async (ctx: restate.ObjectContext<SubmittedState>, req?: Record<string, any>): Promise<State> => {
                // Validate the API key
                await Authorization.CheckAuthorization(
                    ctx as unknown as restate.ObjectSharedContext,
                    `${LeadVirtualObject.name}/sync`,
                    ctx.request().headers.get("authorization"),
                );
                // Run pre-handler setup
                await setup(ctx, ["ACTIVE", "SYNCING"]);
                const leadType = (await ctx.get("LeadType"))!;
                const leadTypeInfo = LeadTypeInfo[leadType];

                // Update the state of the lead to SYNCING
                ctx.set("Status", "SYNCING");
                await SyncWithDB(ctx, "SEND");
                // Iterate through all integrations and call their create/sync handlers
                const integrations = leadTypeInfo.integrations;
                const integrationStates = (await ctx.get("Integrations")) ?? {};

                // Run create/sync method on each integration
                for (const integration of integrations) {
                    if (!integration.shouldRun(ctx)) continue;
                    // Set the default state if it doesn't exist
                    integrationStates[integration.Name] ??= integration.defaultState();
                    const state = integrationStates[integration.Name];
                    // Don't sync closed integration
                    if (state.SyncStatus === "CLOSED") continue;
                    const shouldRunCreate =
                        state.SyncStatus === "NOT SYNCED" || (state.SyncStatus === "ERROR" && state.LastSynced == null);
                    let newState: ExternalIntegrationState;
                    try {
                        if (shouldRunCreate) {
                            ctx.console.info(`Executing 'create' for external integration '${integration.Name}'`, {
                                _meta: 1,
                                label: leadType,
                                Integration: integration.Name,
                                CurrentSyncState: state,
                            });
                            newState = await integration.create(state, ctx);
                            ctx.console.info(
                                `Finished 'create' for external integration '${integration.Name}' with status: '${newState.SyncStatus}'`,
                                {
                                    _meta: 1,
                                    label: leadType,
                                    Integration: integration.Name,
                                    OldSyncState: state,
                                    CurrentSyncState: newState,
                                },
                            );
                        } else {
                            ctx.console.info(`Executing 'sync' for external integration '${integration.Name}'`, {
                                _meta: 1,
                                label: leadType,
                                Integration: integration.Name,
                                CurrentSyncState: state,
                            });
                            newState = await integration.sync(state, ctx);
                            ctx.console.info(
                                `Finished 'sync' for external integration '${integration.Name}' with status: '${newState.SyncStatus}'`,
                                {
                                    _meta: 1,
                                    label: leadType,
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
                                label: leadType,
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
                ctx.set<State["Status"]>("Status", "ACTIVE");
                await SyncWithDB(ctx, "SEND");

                // Return the status of the lead
                return await ctx.objectClient(LeadVirtualObject, ctx.key).status(
                    {},
                    restate.rpc.opts({
                        headers: {
                            authorization: process.env.INTERNAL_API_TOKEN!,
                        },
                    }),
                );
            },
        ),
        /**
         * Marks the lead as closed - which disallows any further syncing or updating - and tell external integrations about it
         */
        close: restate.handlers.object.exclusive(
            async (
                ctx: restate.ObjectContext<SubmittedState>,
                req?: { reason?: string; API_KEY?: string },
            ): Promise<State> => {
                // Validate the API key
                await Authorization.CheckAuthorization(
                    ctx as unknown as restate.ObjectSharedContext,
                    `${LeadVirtualObject.name}/close`,
                    ctx.request().headers.get("authorization"),
                );
                // Run pre-handler setup
                await setup(ctx, ["ACTIVE", "SYNCING", "CLOSED"]);
                const leadType = (await ctx.get("LeadType"))!;
                const leadTypeInfo = LeadTypeInfo[leadType];
                // Iterate through all integrations and call their close handlers
                const integrations = leadTypeInfo.integrations;
                const integrationStates = (await ctx.get("Integrations")) ?? {};
                // Only set the close reason if it wasn't set already
                const closeReason = (await ctx.get("CloseReason")) ?? req?.reason ?? "Not specified";
                ctx.set("CloseReason", closeReason);
                for (const integration of integrations) {
                    if (!integration.shouldRun(ctx)) continue;
                    // Set the default state if it doesn't exist
                    integrationStates[integration.Name] ??= integration.defaultState();
                    const state = integrationStates[integration.Name];
                    if (state.SyncStatus === "CLOSED" || state.SyncStatus === "NOT SYNCED") continue;
                    let newState: ExternalIntegrationState;
                    try {
                        ctx.console.info(`Executing 'close' for external integration '${integration.Name}'`, {
                            _meta: 1,
                            label: leadType,
                            Integration: integration.Name,
                            CurrentSyncState: state,
                        });
                        newState = await integration.close(state, ctx);
                        ctx.console.info(
                            `Finished 'close' for external integration '${integration.Name}' with status '${newState.SyncStatus}'`,
                            {
                                _meta: 1,
                                label: leadType,
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
                        ctx.console.warn(`Error executing 'close' for external integration '${integration.Name}'`, {
                            _meta: 1,
                            label: leadType,
                            Integration: integration.Name,
                            OldSyncState: state,
                            CurrentSyncState: newState,
                        });
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
                // Return the status of the lead
                return await ctx.objectClient(LeadVirtualObject, ctx.key).status(
                    {},
                    restate.rpc.opts({
                        headers: {
                            authorization: process.env.INTERNAL_API_TOKEN!,
                        },
                    }),
                );
            },
        ),
    },
});
