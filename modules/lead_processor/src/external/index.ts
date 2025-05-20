import type {
	ExternalIntegrationState,
	IExternalIntegration,
} from "common/external";
import { TWILIO_CLIENT } from "../twilio";
import type { SubmittedLeadState, Web2TextLead } from "../types";
import { DHQIntegration } from "./dhq/web2text/DHQIntegration";
import { RLMIntegration } from "./rlm/web2text/RLMIntegration";
import { TwilioIntegration } from "./twilio/web2text/TwilioIntegration";
import { BotpressIntegration } from "./botpress/web2text/BotpressIntegration";

export const Web2TextIntegrations: IExternalIntegration<
	SubmittedLeadState<Web2TextLead>,
	ExternalIntegrationState
>[] = [
	new TwilioIntegration(TWILIO_CLIENT),
	new BotpressIntegration(),
	new RLMIntegration(TWILIO_CLIENT),
	new DHQIntegration(TWILIO_CLIENT),
];
