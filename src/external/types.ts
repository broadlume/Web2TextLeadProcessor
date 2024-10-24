import type { ObjectSharedContext } from "@restatedev/restate-sdk";
import { z } from "zod";
import type { Web2TextLead } from "../types";

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
	State extends ExternalIntegrationState,
> {
	abstract Name: string;
	abstract defaultState(): State;
	abstract create(
		state: State,
		context: ObjectSharedContext<Web2TextLead>,
	): Promise<State>;
	abstract sync(
		state: State,
		context: ObjectSharedContext<Web2TextLead>,
	): Promise<State>;
	abstract close(
		state: State,
		context: ObjectSharedContext<Web2TextLead>,
	): Promise<State>;
}
