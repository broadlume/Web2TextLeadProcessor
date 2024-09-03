import { RLMIntegration } from "./rlm";
import type { ExternalIntegrationState, IExternalIntegration } from "./types";
import { TwilioIntegration } from './twilio';

export const Web2TextIntegrations: IExternalIntegration<ExternalIntegrationState>[] = [new TwilioIntegration(), new RLMIntegration()];

