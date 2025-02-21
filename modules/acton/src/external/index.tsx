import { ExternalIntegrationState, IExternalIntegration } from 'common/external';
import { LeadState } from '../types';
import { ActOnIntegration } from './ActOn/ActOnIntegration';
import { FfWebApiIntegration } from './FfWebApi/FfWebApiIntegration';
export const WebLeadIntegrations : IExternalIntegration<LeadState, ExternalIntegrationState>[] = [
    new ActOnIntegration(),
    new FfWebApiIntegration()
];