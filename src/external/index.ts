import { DHQIntegration } from "./DHQ/DHQIntegration";
import { RLMIntegration } from "./rlm";
import { TwilioIntegration } from "./twilio";
import type { ExternalIntegrationState, IExternalIntegration } from "./types";

export const Web2TextIntegrations: IExternalIntegration<ExternalIntegrationState>[] =
	[
		new TwilioIntegration(globalThis.TWILIO_CLIENT),
		new RLMIntegration(globalThis.TWILIO_CLIENT),
		new DHQIntegration(globalThis.TWILIO_CLIENT),
	];
