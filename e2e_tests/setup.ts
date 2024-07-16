import { beforeAll, beforeEach, afterAll } from "bun:test";
import { $, type Server } from "bun";
import * as restateFetch from "@restatedev/restate-sdk/fetch";
import { LeadVirtualObject } from "../src/restate/LeadVirtualObject";
import request from "supertest";
import dynamoose from "dynamoose";
import { APIKeyModel } from "../src/dynamodb/APIKeyModel";
import { Web2TextIntegrations } from "../src/external";
import { MockIntegration } from "./mockIntegration";
import { randomUUID } from "node:crypto";

export let TEST_SERVER: Server;
export const supertest = request(`http://${process.env.RESTATE_HOST}:8080/`);
export const SERVICE_NAME = "Lead-test";
export const TEST_API_KEY: string = "8695e2fa-3bf7-4949-ba2b-2605ace32b85";

beforeAll(async () => {
	process.env.INTERNAL_TOKEN ??= randomUUID();
	// Point dynamoose to our local DynamoDB for testing
	dynamoose.aws.ddb.local(process.env.LOCAL_DYNAMODB_URL);
	// Create a testing API key in the DynamoDB
	await APIKeyModel.create(
		{
			API_Key: TEST_API_KEY,
			Active: true,
			DateCreated: new Date().toISOString(),
			Description: "E2E Test API Key",
		},
		{ overwrite: true },
	);

	// Overwrite the service name with our own testing service name so we don't interfere with any other services running
	Object.assign(LeadVirtualObject, { name: SERVICE_NAME });

	// Replace integrations with a mock integration
	Object.assign(Web2TextIntegrations, [new MockIntegration()]);

	// Setup restate handler as an HTTP1 handler (Bun doesn't support HTTP2 servers yet)
	const handler = restateFetch.endpoint().bind(LeadVirtualObject).handler();
	TEST_SERVER = Bun.serve({
		port: 9075,
		...handler,
	});

	// Register the service and clear ports
	await $`bun run register-with-restate -- --use-http1.1`.quiet().then(() => {
		console.info("[E2E Tests] Registered test service with Restate server");
	});
});

beforeEach(async () => {
	// Clear the state between each test
	await $`bun run clear-restate-test`.quiet();
});

afterAll(async () => {
	await $`bun run clear-restate-test`.quiet();
	// De register the deployment
	const table = await $`restate services list`.text();
	const deploymentId = /dp_[a-zA-z\d]+/.exec(table)?.[0];
	if (deploymentId != null) {
		await $`restate deployments remove ${deploymentId} --force --yes`.quiet();
		console.info("[E2E Tests] De-registered test service with Restate server");
	}
	TEST_SERVER.stop(true);
});
