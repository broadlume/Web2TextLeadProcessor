import "dotenv/config";
import * as restate from "@restatedev/restate-sdk";
import { LeadVirtualObject } from "./restate/LeadVirtualObject";
import { randomUUID } from "node:crypto";
import type os from "node:os";
import "./dynamodb/index";
import {
	DeregisterThisServiceWithRestate,
	RegisterThisServiceWithRestate,
} from "./restate/server-helpers";
const RESTATE_PORT = 9080;

process.env.INTERNAL_TOKEN ??= randomUUID();
// Create the Restate server to accept requests
restate.endpoint().bind(LeadVirtualObject).listen(RESTATE_PORT);
let registeredRestateAddress: os.NetworkInterfaceInfo | null = null;

if (process.env.NODE_ENV === "production") {
	RegisterThisServiceWithRestate(RESTATE_PORT).then((ipAddr) => {
		registeredRestateAddress = ipAddr;
	});

	process.once("SIGTERM", async () => {
		if (registeredRestateAddress) {
			await DeregisterThisServiceWithRestate(
				registeredRestateAddress.address,
				RESTATE_PORT,
				// Try de-registering the service every 5 seconds for an hour (max time ECS will drain a task for)
				{
					maxAttempts: 720,
					attemptDelayMs: 5000,
				},
			).catch((e) => console.error(e));
		}
		process.exit();
	});
	process.once("SIGINT", async () => {
		if (registeredRestateAddress) {
			await DeregisterThisServiceWithRestate(
				registeredRestateAddress.address,
				RESTATE_PORT,
				// Try de-registering the service every 5 seconds for an hour (max time ECS will drain a task for)
				{
					maxAttempts: 720,
					attemptDelayMs: 5000,
				},
			).catch((e) => console.error(e));
		}
		process.exit();
	});
}
