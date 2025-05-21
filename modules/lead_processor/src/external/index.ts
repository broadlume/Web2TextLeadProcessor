import type {
	ExternalIntegrationState,
	IExternalIntegration,
} from "common/external";
import { BotpressIntegration } from "#external/botpress/web2text/BotpressIntegration";
import { DHQIntegration } from "#external/dhq/web2text/DHQIntegration";
import { RLMIntegration } from "#external/rlm/web2text/RLMIntegration";
import { TwilioIntegration } from "#external/twilio/web2text/TwilioIntegration";
import type { Web2TextLead } from "#lead/web2text";
import type { SubmittedLeadState } from "../lead/schema";
import { TWILIO_CLIENT } from "../twilio";

export const Web2TextIntegrations: IExternalIntegration<
	SubmittedLeadState<Web2TextLead>,
	ExternalIntegrationState
>[] = [
	new TwilioIntegration(TWILIO_CLIENT),
	new BotpressIntegration(),
	new RLMIntegration(TWILIO_CLIENT),
	new DHQIntegration(TWILIO_CLIENT),
];
