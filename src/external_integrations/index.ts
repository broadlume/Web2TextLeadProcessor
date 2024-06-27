
import { z } from "zod";
import { TwilioIntegration } from "./TwilioIntegration";
import type { SubmittedLeadState } from "../restate/common";

export const ExternalIntegrationStateSchema = z.object({
	Name: z.string().min(1,"Name cannot be empty"),
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
	abstract create(state: State, context: Readonly<SubmittedLeadState>): Promise<State>;
	abstract sync(state: State, context: Readonly<SubmittedLeadState>): Promise<State>;
}

export const Web2TextIntegrations: IExternalIntegration<ExternalIntegrationState>[] = [new TwilioIntegration()];


export function DefaultIntegrationState(
	integrations: IExternalIntegration<ExternalIntegrationState>[],
): ExternalIntegrationState[] {
    const state = integrations.map(integration => integration.defaultState());

    // biome-ignore lint/performance/noAccumulatingSpread: <explanation>
    const nameCounts = state.map(s => s.Name).reduce((cnt, cur) => ({...cnt,[cur]: (cnt[cur] ?? 0) + 1}), {} as Record<string,number>);
    for (const [name,count] of Object.entries(nameCounts)) {
        if (count > 1) {
            throw new Error(`There are two or more integrations with the same name: '${name}' - this is not allowed`);
        }
    }
    return state;
}
