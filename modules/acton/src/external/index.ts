import type {
	ExternalIntegrationState,
	IExternalIntegration,
} from "common/external";
import { FfWebApiIntegration } from "../external/FfWebApi/FfWebApiIntegration";
import type { LeadState } from "../types";
import { ActOnIntegration } from "./ActOn/ActOnIntegration";
export const WebLeadIntegrations: IExternalIntegration<
	LeadState,
	ExternalIntegrationState
>[] = [new ActOnIntegration(), new FfWebApiIntegration()];
