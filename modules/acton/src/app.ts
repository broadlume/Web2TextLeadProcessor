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
import { LeadStateModel } from "./dynamodb/LeadStateModel";
import { VerifyEnvVariables } from "./verifyEnvVariables";
import { WebLeadVirtualObject } from "./restate/services/WebLeadVirtualObject";

// Randomize internal API token
process.env.INTERNAL_API_TOKEN ??= randomUUID();
// Verify env variables and crash if any are invalid/missing
if (GetRunningEnvironment().environment !== "test") {
	if (!VerifyEnvVariables()) {
		process.exit(1);
	}
} else {
	Object.assign(WebLeadVirtualObject, { name: `${WebLeadVirtualObject.name}-test` });
}

// Initialize the local DynamoDB instance and create the necessary tables
if (GetRunningEnvironment().local) {
	InitLocalDynamoDb([LeadStateModel]);
}

// Create the Restate server to accept requests
const RESTATE_PORT = 9080;
const restateLogger = _logger.child({
	label: "Restate",
});
export const RESTATE_SERVER = restate
	.endpoint()
	.setLogger(CreateNewRestateLogger(restateLogger))
	.bind(WebLeadVirtualObject);
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
