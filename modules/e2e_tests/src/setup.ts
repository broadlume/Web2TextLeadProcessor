import type http2 from "node:http2";
import { RestateAdminDeploymentAPI } from "common/external/restate";
import dotenv from "dotenv";
import { startServer } from "lead-processor-service/app";
import { http, passthrough } from "msw";
import request from "supertest";
import { v4 as uuidv4 } from "uuid";
import { afterAll, afterEach, beforeAll, inject } from "vitest";
import { mockServer } from "./mock/server";

export const TEST_API_KEY = process.env.INTERNAL_API_TOKEN ?? uuidv4();
export const supertest = request(inject("RESTATE_INGRESS_URL"));
export let leadProcessorService: http2.Http2Server;

async function globalSetup() {
    // @ts-ignore
    if (globalThis.GLOBAL_SETUP_DONE) {
        return;
    }
    dotenv.config({
        path: ".env.test",
    });
    process.env.INTERNAL_API_TOKEN = TEST_API_KEY;
    leadProcessorService = await startServer();
    console.log("Registering lead processor service deployment...");
    await RestateAdminDeploymentAPI.CreateDeployment("http://172.17.0.1:9080", {
        force: true,
    });
    console.log("Registered lead processor service deployment");
    // @ts-ignore
    globalThis.GLOBAL_SETUP_DONE = true;
}

beforeAll(async () => {
    mockServer.listen({ onUnhandledRequest: "error" });
    mockServer.use(
        http.all(`${inject("RESTATE_INGRESS_URL")}*`, passthrough),
        http.all(`${inject("RESTATE_ADMIN_URL")}*`, passthrough),
    );
    await globalSetup();
});
afterEach(() => {
    mockServer.resetHandlers();
    mockServer.use(
        http.all(`${inject("RESTATE_INGRESS_URL")}*`, passthrough),
        http.all(`${inject("RESTATE_ADMIN_URL")}*`, passthrough),
    );
});
afterAll(() => mockServer.close());
