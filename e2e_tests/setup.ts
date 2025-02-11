import { randomUUID } from "node:crypto";
import type * as restate from "@restatedev/restate-sdk";
import dynamoose from "dynamoose";
import shelljs from "shelljs";
import request from "supertest";
import { beforeAll, beforeEach, vi } from "vitest";
import "dotenv/config";
import nock from "nock";
import {
	ADMIN_SERVICE_NAME,
	DEALER_SERVICE_NAME,
	LEAD_SERVICE_NAME,
} from "./globalSetup";
import { RestateAdminDeploymentAPI } from "../src/common/src/external/restate";
import { DealerVirtualObject } from "../src/web2text/restate/services/DealerVirtualObject";
import { APIKeyModel } from "../src/web2text/dynamodb/APIKeyModel";
import { LeadVirtualObject } from "../src/web2text/restate/services/LeadVirtualObject";
import { AdminService } from "../src/web2text/restate/services/AdminService";
import { LeadState } from "src/web2text/types";
export const RESTATE_INGRESS_URL = `http://${new URL(process.env.RESTATE_ADMIN_URL!.replace("admin.", "")).hostname}:8080/`;
export const supertest = request(RESTATE_INGRESS_URL);
export const TEST_API_KEY: string = "8695e2fa-3bf7-4949-ba2b-2605ace32b85";
export let TEST_SERVER: restate.RestateEndpoint;

beforeAll(async () => {
	//@ts-expect-error
	if (globalThis.ranSetup) return;
	process.env.INTERNAL_API_TOKEN = randomUUID();
	// Point dynamoose to our local DynamoDB for testing
	dynamoose.aws.ddb.local(process.env.LOCAL_DYNAMODB_URL);
	// Create a testing API key in the DynamoDB
	await APIKeyModel.create(
		{
			API_Key: TEST_API_KEY,
			Active: true,
			DateCreated: new Date().toISOString(),
			AuthorizedEndpoints: ["*"],
			Description: "E2E Test API Key",
		},
		{ overwrite: true },
	);

	// Overwrite the service name with our own testing service name so we don't interfere with any other services running
	Object.assign(LeadVirtualObject, { name: LEAD_SERVICE_NAME });
	Object.assign(DealerVirtualObject, { name: DEALER_SERVICE_NAME });
	Object.assign(AdminService, { name: ADMIN_SERVICE_NAME });

	// Setup restate handler
	TEST_SERVER = (await import("../src/web2text/app")).RESTATE_SERVER;
	await RestateAdminDeploymentAPI.CreateDeployment(
		"http://web2text-devcontainer:9080",
		{
			force: true,
		},
	);
	// Turn off DynamoDB sync when testing
	vi.mock("../src/restate/db", () => ({
		SyncWithDB: vi.fn().mockImplementation(() => {}),
	}));
	vi.mock("../src/web2text/external", () => ({
		Web2TextIntegrations: [
			{
				defaultState: () => ({ SyncStatus: "NOT SYNCED" }),
				create: (state: LeadState) => ({ ...state, SyncStatus: "SYNCED" }),
				sync: (state: LeadState) => ({ ...state, SyncStatus: "SYNCED" }),
				close: (state: LeadState) => ({ ...state, SyncStatus: "CLOSED" }),
			},
		],
	}));
	vi.mock("../src/common/external/nexus/NexusAWSAuth", () => ({
		GetNexusAWSAuthToken: () => Promise.resolve("fake-token")
	}));
	//@ts-expect-error
	globalThis.ranSetup = true;
});

beforeEach(async () => {
	nock.cleanAll();
	nock.enableNetConnect();
	// Clear the state between each test
	await new Promise((resolve, reject) =>
		shelljs.exec(
			"bun run clear-restate-test",
			{ silent: true, async: true },
			(code, stdout, stderr) => (code === 0 ? resolve(stdout) : reject(stderr)),
		),
	).catch((err) => {
		console.error(err);
	});
	nock.disableNetConnect();
	nock.enableNetConnect((host) => {
		const allowedHosts = [
			LEAD_SERVICE_NAME,
			DEALER_SERVICE_NAME,
			ADMIN_SERVICE_NAME,
			"127.0.0.1",
			"127.0.0.11",
			new URL(process.env.LOCAL_DYNAMODB_URL!).hostname,
			new URL(process.env.RESTATE_ADMIN_URL!).hostname,
			new URL(RESTATE_INGRESS_URL).hostname,
		];
		return (
			allowedHosts.find((allowedHost) =>
				host.toLowerCase().includes(allowedHost.toLowerCase()),
			) != null
		);
	});
});
