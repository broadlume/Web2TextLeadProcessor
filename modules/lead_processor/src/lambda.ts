import "dotenv/config";
import * as restate from "@restatedev/restate-sdk/lambda";
import { logger as _logger } from "common";
import { CreateNewRestateLogger } from "common/restate";
import { AdminService, DealerVirtualObject, LeadVirtualObject, TwilioWebhooks } from "#restate";
import { TWILIO_CLIENT } from "./twilio";

globalThis.TWILIO_CLIENT = TWILIO_CLIENT;
const restateLogger = _logger.child({
    label: "Restate",
});
// Create the lambda handler to accept requests
export const handler = restate
    .endpoint()
    .setLogger(CreateNewRestateLogger(restateLogger))
    .bind(LeadVirtualObject)
    .bind(DealerVirtualObject)
    .bind(AdminService)
    .bind(TwilioWebhooks)
    .handler();
