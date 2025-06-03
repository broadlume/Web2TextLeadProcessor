import { randomUUID } from "node:crypto";
import type * as restate from "@restatedev/restate-sdk";
import { APIKeyModel } from "common/dynamodb";
import { RestateAdminDeploymentAPI } from "common/external/restate";
import dynamoose from "dynamoose";
import { Web2TextIntegrations } from "lead-processor-service/external/index";
import nock from "nock";
import request from "supertest";
import { beforeAll, vi } from "vitest";
import { ADMIN_SERVICE_NAME, DEALER_SERVICE_NAME, LEAD_SERVICE_NAME } from "./globalSetup";
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
    // Turn off DynamoDB sync when testing
    vi.mock("lead-processor-service/restate/db", () => ({
        SyncWithDB: vi.fn().mockImplementation(() => {}),
    }));

    // Clear the Web2TextIntegrations and replace with a mocked one
    Web2TextIntegrations.splice(0, Number.POSITIVE_INFINITY);
    Web2TextIntegrations.push({
        Name: "Test Integration",
        shouldRun: () => Promise.resolve(true),
        defaultState: () => ({ SyncStatus: "NOT SYNCED" }),
        create: (state: any, context: any) => ({ ...state, SyncStatus: "SYNCED" }),
        sync: (state: any, context: any) => ({ ...state, SyncStatus: "SYNCED" }),
        close: (state: any, context: any) => ({ ...state, SyncStatus: "CLOSED" }),
    });

    // Setup restate handler
    TEST_SERVER = (await import("lead-processor-service/app")).RESTATE_SERVER;
    await RestateAdminDeploymentAPI.CreateDeployment("http://lead-processor-service-devcontainer:9080", {
        force: true,
    });
    //@ts-expect-error
    globalThis.ranSetup = true;
});

beforeAll(async () => {
    nock.cleanAll();
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
        return allowedHosts.find((allowedHost) => host.toLowerCase().includes(allowedHost.toLowerCase())) != null;
    });
});
