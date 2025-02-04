import "dotenv/config";
import { randomUUID } from "node:crypto";
import type os from "node:os";
import * as restate from "@restatedev/restate-sdk";
import { LeadVirtualObject } from "./restate/services/LeadVirtualObject";
import "./dynamodb/index";
import util from "node:util";
import { serializeError } from "serialize-error";
import { Twilio } from "twilio";
import {
	DeregisterThisServiceWithRestate,
	RegisterThisServiceWithRestate,
} from "./ServiceRegistrationHelper";
import { logger as _logger } from "./logger";
import { AdminService } from "./restate/services/AdminService";
import { DealerVirtualObject } from "./restate/services/DealerVirtualObject";
import { TwilioWebhooks } from "./restate/services/TwilioWebhooks";
import { VerifyEnvVariables } from "./verifyEnvVariables";


// Randomize internal API token
process.env.INTERNAL_API_TOKEN ??= randomUUID();
// Verify env variables and crash if any are invalid/missing
VerifyEnvVariables();

// Setup global twilio client
globalThis.TWILIO_CLIENT = new Twilio(
	process.env.TWILIO_ACCOUNT_SID,
	process.env.TWILIO_AUTH_TOKEN,
);

// Create the Restate server to accept requests
const RESTATE_PORT = 9080;
const restateLogger = _logger.child({
	label: "Restate",
});
export const RESTATE_SERVER = restate
	.endpoint()
	.setLogger((params, message, ...o) => {
		const separated: { messages: string[]; errors: Error[]; meta: any } = [
			message,
			...o,
		].reduce(
			(acc, m) => {
				if (m instanceof Error) {
					acc.errors.push(m);
				} else {
					if (typeof m === "string") {
						acc.messages.push(m);
					} else {
						if (typeof m === "object" && m["_meta"] != null) {
							delete m["_meta"];
							acc.meta = m;
						} else {
							acc.messages.push(util.inspect(m, false, null, true));
						}
					}
				}
				return acc;
			},
			{ messages: [], errors: [], meta: {} },
		);
		restateLogger.log(params.level, separated.messages.join(" "), {
			...params,
			...separated.meta,
			label: [
				"Restate",
				params.context?.invocationTarget,
				params.context?.invocationId,
				...[separated.meta.label].flat().filter((x) => x != null),
			],
			errors: separated.errors.map((e: Error) => serializeError(e)),
		});
	})
	.bind(LeadVirtualObject)
	.bind(DealerVirtualObject)
	.bind(AdminService)
	.bind(TwilioWebhooks);
RESTATE_SERVER.listen(RESTATE_PORT);
let registeredRestateAddress: os.NetworkInterfaceInfo | null = null;

if (process.env.NODE_ENV === "production") {
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
