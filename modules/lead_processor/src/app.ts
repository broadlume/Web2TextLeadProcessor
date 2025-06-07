import "dotenv/config";
import { randomUUID } from "node:crypto";
import http2 from "node:http2";
import * as restate from "@restatedev/restate-sdk";
import { logger as _logger, GetRunningEnvironment } from "common";
import { InitLocalDynamoDb } from "common/dynamodb";
import { CreateNewRestateLogger } from "common/restate";
import { LeadStateModel, OptedOutNumberModel } from "#dynamodb";
import { AdminService, DealerVirtualObject, LeadVirtualObject, TwilioWebhooks, WebhookVirtualObject } from "#restate";
import { VerifyEnvVariables } from "./env";
import { TWILIO_CLIENT } from "./twilio";

// Create the Restate server to accept requests
const RESTATE_PORT = 9080;
const restateLogger = _logger.child({
    label: "Restate",
});
export const RESTATE_ENDPOINTS = restate
    .endpoint()
    .setLogger(CreateNewRestateLogger(restateLogger))
    .bind(LeadVirtualObject)
    .bind(DealerVirtualObject)
    .bind(AdminService)
    .bind(TwilioWebhooks)
    .bind(WebhookVirtualObject);

export async function startServer(): Promise<http2.Http2Server> {
    // Randomize internal API token
    process.env.INTERNAL_API_TOKEN ??= randomUUID();
    // Verify env variables and crash if any are invalid/missing
    if (GetRunningEnvironment().environment !== "test") {
        if (!VerifyEnvVariables()) {
            process.exit(1);
        }
    }
    globalThis.TWILIO_CLIENT = TWILIO_CLIENT;

    // Initialize the local DynamoDB instance and create the necessary tables
    if (GetRunningEnvironment().local) {
        InitLocalDynamoDb([LeadStateModel, OptedOutNumberModel]);
    }
    const RESTATE_SERVER = http2.createServer(RESTATE_ENDPOINTS.http2Handler());
    return await new Promise((resolve, reject) => {
        RESTATE_SERVER.listen(RESTATE_PORT, undefined, undefined, () => resolve(RESTATE_SERVER)).on("error", reject);
    });
}
if (GetRunningEnvironment().environment !== "test") {
    startServer().then((server) => {
        _logger.info(`Lead service endpoints are listening on port ${RESTATE_PORT}`, {
            label: "Lead Processor",
        });
    });
}
