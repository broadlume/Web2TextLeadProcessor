import type {
	ExternalIntegrationState,
	IExternalIntegration,
} from "common/external";
import { TWILIO_CLIENT } from "../twilio";
import type { SubmittedLeadState, Web2TextLead } from "../types";
import { DHQIntegration } from "./dhq/DHQIntegration";
import { RLMIntegration } from "./rlm/RLMIntegration";
import { TwilioIntegration } from "./twilio/TwilioIntegration";
import { BotpressIntegration } from "./botpress/BotpressIntegration";

export const Web2TextIntegrations: IExternalIntegration<
	SubmittedLeadState<Web2TextLead>,
	ExternalIntegrationState
>[] = [
	new TwilioIntegration(TWILIO_CLIENT),
	new BotpressIntegration(),
	new RLMIntegration(TWILIO_CLIENT),
	new DHQIntegration(TWILIO_CLIENT),
];
