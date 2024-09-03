import { beforeAll, beforeEach } from "vitest";
import request from "supertest";
import shelljs from "shelljs";
import { randomUUID } from "node:crypto";
import { APIKeyModel } from "../src/dynamodb/APIKeyModel";
import dynamoose from "dynamoose";
import { LeadVirtualObject } from "../src/restate/LeadVirtualObject";
import * as restate from "@restatedev/restate-sdk";
import "dotenv/config";
import nock from "nock";

export const supertest = request(`http://${process.env.RESTATE_HOST}:8080/`);
export const SERVICE_NAME = "Lead-test";
export const TEST_API_KEY: string = "8695e2fa-3bf7-4949-ba2b-2605ace32b85";
export let TEST_SERVER: restate.RestateEndpoint;

beforeAll(async () => {
	if (globalThis.ranSetup) return;
	process.env.INTERNAL_TOKEN = randomUUID();
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

	// Setup restate handler
	TEST_SERVER = restate.endpoint().bind(LeadVirtualObject);
	await TEST_SERVER.listen(9080);
	// Register the service with the restate server
	await new Promise((resolve,reject) => shelljs.exec("bun run register-with-restate", { silent: true, async: true}, (code,stdout,stderr) => code === 0 ? resolve(stdout) : reject(stderr))).then((out) => {
		console.info(
			"[E2E Tests] Registered test service with Restate server",
		);
	}, (err) => {
		console.error(err);
	});
	globalThis.ranSetup = true;
});

beforeEach(async () => {
	nock.cleanAll();
	nock.enableNetConnect();
	// Clear the state between each test
	await new Promise((resolve,reject) => shelljs.exec("bun run clear-restate-test", { silent: true, async: true}, (code,stdout,stderr) => code === 0 ? resolve(stdout) : reject(stderr))).catch((err) => {
		console.error(err);
	});
	nock.disableNetConnect();
	nock.enableNetConnect(host => {
		const allowedHosts = ["lead-test","127.0.0.1","127.0.0.11",new URL(process.env.LOCAL_DYNAMODB_URL!).hostname,process.env.RESTATE_HOST!];
		return allowedHosts.find(allowedHost => host.toLowerCase().includes(allowedHost.toLowerCase())) != null;
	});
});
