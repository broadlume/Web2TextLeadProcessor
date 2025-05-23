import "dotenv/config";
import { randomUUID } from "node:crypto";
import type os from "node:os";
import * as restate from "@restatedev/restate-sdk";
import { GetRunningEnvironment, logger as _logger, isDeployed } from "common";
import { InitLocalDynamoDb } from "common/dynamodb";
import {
	CreateNewRestateLogger,
	RegisterThisServiceWithRestate,
} from "common/restate";
import { LeadStateModel, OptedOutNumberModel } from "#dynamodb";
import { AdminService, DealerVirtualObject, LeadVirtualObject, TwilioWebhooks } from "#restate";
import { VerifyEnvVariables } from "./env";
import { TWILIO_CLIENT } from "./twilio";

// Randomize internal API token
process.env.INTERNAL_API_TOKEN ??= randomUUID();
// Verify env variables and crash if any are invalid/missing
if (GetRunningEnvironment().environment !== "test") {
	if (!VerifyEnvVariables()) {
		process.exit(1);
	}
} else {
	Object.assign(LeadVirtualObject, { name: `${LeadVirtualObject.name}-test` });
	Object.assign(DealerVirtualObject, {
		name: `${DealerVirtualObject.name}-test`,
	});
	Object.assign(AdminService, { name: `${AdminService.name}-test` });
	Object.assign(TwilioWebhooks, { name: `${TwilioWebhooks.name}-test` });
}
globalThis.TWILIO_CLIENT = TWILIO_CLIENT;

// Initialize the local DynamoDB instance and create the necessary tables
if (GetRunningEnvironment().local) {
	InitLocalDynamoDb([LeadStateModel, OptedOutNumberModel]);
}

// Create the Restate server to accept requests
const RESTATE_PORT = 9080;
const restateLogger = _logger.child({
	label: "Restate",
});
export const RESTATE_SERVER = restate
	.endpoint()
	.setLogger(CreateNewRestateLogger(restateLogger))
	.bind(LeadVirtualObject)
	.bind(DealerVirtualObject)
	.bind(AdminService)
	.bind(TwilioWebhooks);
RESTATE_SERVER.listen(RESTATE_PORT);
if (isDeployed()) {
	let registeredRestateAddress: os.NetworkInterfaceInfo | null = null;
	const startupLogger = _logger.child({ label: "Startup" });
	startupLogger.info(`Restate Admin URL: ${process.env.RESTATE_ADMIN_URL}`);
	RegisterThisServiceWithRestate(RESTATE_PORT)
		.then((ipAddr) => {
			if (ipAddr == null) {
				startupLogger.warn(
					"Failed to register this service with Restate admin panel - shutting down...",
				);
				process.exit(1);
			}
			registeredRestateAddress = ipAddr;
		})
		.catch((e) => {
			startupLogger.error(e);
			startupLogger.warn(
				"Failed to register this service with Restate admin panel - shutting down...",
			);
			process.exit(1);
		});
}
