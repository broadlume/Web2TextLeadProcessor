import type { ObjectSharedContext } from "@restatedev/restate-sdk";
import { z } from "zod";

export const ExternalIntegrationStateSchema = z.object({
	SyncStatus: z.enum(["NOT SYNCED", "SYNCING", "SYNCED", "ERROR"]),
	Data: z.any().optional(),
	LastSynced: z.string().datetime().optional(),
	Error: z.object({
		Message: z.string(),
		Details: z.any().optional()
	}).optional()
});
export type ExternalIntegrationState = z.infer<typeof ExternalIntegrationStateSchema>;

export abstract class IExternalIntegration<
	State extends ExternalIntegrationState,
> {
    abstract Name: string;
    abstract defaultState(): State
	abstract create(state: State, context: ObjectSharedContext): Promise<State>;
	abstract sync(state: State, context: ObjectSharedContext): Promise<State>;
	abstract close(state: State, context: ObjectSharedContext): Promise<State>;
}