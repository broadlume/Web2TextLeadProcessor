import type { ObjectSharedContext } from "@restatedev/restate-sdk";
import { z } from "zod";

export const ExternalIntegrationStateSchema = z.object({
	SyncStatus: z.enum(["NOT SYNCED", "SYNCING", "SYNCED", "ERROR", "CLOSED"]),
	Data: z.any().optional(),
	LastSynced: z.string().datetime().optional(),
	ErrorInfo: z
		.object({
			Message: z.string(),
			Details: z.any().optional(),
			ErrorDate: z.string().optional(),
		})
		.optional(),
});
export type ExternalIntegrationState = z.infer<
	typeof ExternalIntegrationStateSchema
>;

export abstract class IExternalIntegration<
	CONTEXT extends Record<string, any>,
	STATE extends ExternalIntegrationState,
> {
	abstract Name: string;
	shouldRun(context: ObjectSharedContext<CONTEXT>): Promise<boolean> {
		return Promise.resolve(true);
	}
	abstract defaultState(): STATE;
	abstract create(
		state: STATE,
		context: ObjectSharedContext<CONTEXT>,
	): Promise<STATE>;
	abstract sync(
		state: STATE,
		context: ObjectSharedContext<CONTEXT>,
	): Promise<STATE>;
	abstract close(
		state: STATE,
		context: ObjectSharedContext<CONTEXT>,
	): Promise<STATE>;
}

export abstract class Into<TO> {
	public abstract into(): TO;
}
