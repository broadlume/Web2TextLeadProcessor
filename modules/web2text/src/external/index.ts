import type {
	ExternalIntegrationState,
	IExternalIntegration,
} from "common/external";
import type { LeadState } from "../types";
import { DHQIntegration } from "./DHQ/DHQIntegration";
import { RLMIntegration } from "./rlm/RLMIntegration";
import { TwilioIntegration } from "./twilio/TwilioIntegration";
import { TWILIO_CLIENT } from "../twilio";

export const Web2TextIntegrations: IExternalIntegration<
	LeadState,
	ExternalIntegrationState
>[] = [
	new TwilioIntegration(TWILIO_CLIENT),
	new RLMIntegration(TWILIO_CLIENT),
	new DHQIntegration(TWILIO_CLIENT),
];
