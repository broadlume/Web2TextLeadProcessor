import { RLMIntegration } from "./rlm";
import type { ExternalIntegrationState, IExternalIntegration } from "./types";
import { TwilioIntegration } from './twilio';
import { DHQIntegration } from "./DHQ/DHQIntegration";

export const Web2TextIntegrations: IExternalIntegration<ExternalIntegrationState>[] = [new TwilioIntegration(globalThis.TWILIO_CLIENT), new RLMIntegration(globalThis.TWILIO_CLIENT), new DHQIntegration(globalThis.TWILIO_CLIENT)];