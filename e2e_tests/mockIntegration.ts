import type { ObjectSharedContext } from "@restatedev/restate-sdk";
import { type ExternalIntegrationState, IExternalIntegration } from "../src/external/types";

export class MockIntegration extends IExternalIntegration<ExternalIntegrationState> {
    Name = "MockIntegration";
    defaultState(): ExternalIntegrationState {
        return {SyncStatus: "NOT SYNCED"}
    }
    async create(state: ExternalIntegrationState, context: ObjectSharedContext): Promise<ExternalIntegrationState> {
        return {
            ...state,
            SyncStatus: "SYNCED"
        };
    }
    async sync(state: ExternalIntegrationState, context: ObjectSharedContext): Promise<ExternalIntegrationState> {
        return {
            ...state,
            SyncStatus: "SYNCED"
        };
    }
    async close(state: ExternalIntegrationState, context: ObjectSharedContext): Promise<ExternalIntegrationState> {
        return {
            ...state,
            SyncStatus: "SYNCED"
        };
    }

}