import type { IExternalIntegration, ExternalIntegrationState } from "@common/external";
import { DHQIntegration } from "./DHQ/DHQIntegration";
import { RLMIntegration } from "./rlm/RLMIntegration";
import { TwilioIntegration } from "./twilio/TwilioIntegration";

export const Web2TextIntegrations: IExternalIntegration<ExternalIntegrationState>[] =
	[
		new TwilioIntegration(globalThis.TWILIO_CLIENT),
		new RLMIntegration(globalThis.TWILIO_CLIENT),
		new DHQIntegration(globalThis.TWILIO_CLIENT),
	];