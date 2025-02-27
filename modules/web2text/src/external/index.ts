import type {
	ExternalIntegrationState,
	IExternalIntegration,
} from "common/external";
import { TWILIO_CLIENT } from "../twilio";
import type { LeadState } from "../types";
import { DHQIntegration } from "./dhq/DHQIntegration";
import { RLMIntegration } from "./rlm/RLMIntegration";
import { TwilioIntegration } from "./twilio/TwilioIntegration";

export const Web2TextIntegrations: IExternalIntegration<
	LeadState,
	ExternalIntegrationState
>[] = [
	new TwilioIntegration(TWILIO_CLIENT),
	new RLMIntegration(TWILIO_CLIENT),
	new DHQIntegration(TWILIO_CLIENT),
];
