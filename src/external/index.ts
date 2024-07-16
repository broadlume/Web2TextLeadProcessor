
import { RLMIntegration } from "./rlm/RLMIntegration";
import { TwilioIntegration } from "./twilio/TwilioIntegration";
import type { ExternalIntegrationState, IExternalIntegration } from "./types";

export const Web2TextIntegrations: IExternalIntegration<ExternalIntegrationState>[] = [new TwilioIntegration(), new RLMIntegration()];

