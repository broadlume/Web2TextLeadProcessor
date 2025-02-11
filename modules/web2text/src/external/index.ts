import type {
	ExternalIntegrationState,
	IExternalIntegration,
} from "common/external";
import type { LeadState } from "../types";
import { DHQIntegration } from "./DHQ/DHQIntegration";
import { RLMIntegration } from "./rlm/RLMIntegration";
import { TwilioIntegration } from "./twilio/TwilioIntegration";

export const Web2TextIntegrations: IExternalIntegration<
	LeadState,
	ExternalIntegrationState
>[] = [
	new TwilioIntegration(globalThis.TWILIO_CLIENT),
	new RLMIntegration(globalThis.TWILIO_CLIENT),
	new DHQIntegration(globalThis.TWILIO_CLIENT),
];
