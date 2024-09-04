import { RLMIntegration } from "./rlm";
import type { ExternalIntegrationState, IExternalIntegration } from "./types";
import { TwilioIntegration } from './twilio';
import { DHQIntegration } from "./DHQ/DHQIntegration";

export const Web2TextIntegrations: IExternalIntegration<ExternalIntegrationState>[] = [new TwilioIntegration(), new RLMIntegration(), new DHQIntegration()];