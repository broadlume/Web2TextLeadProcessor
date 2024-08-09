
import { RLMIntegration } from "./rlm/RLMIntegration";
import type { ExternalIntegrationState, IExternalIntegration } from "./types";
import { TwilioIntegration } from './twilio/TwilioIntegration';

export const Web2TextIntegrations: IExternalIntegration<ExternalIntegrationState>[] = [new TwilioIntegration(), new RLMIntegration()];

