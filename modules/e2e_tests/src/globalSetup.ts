import { RestateTestEnvironment } from "@restatedev/restate-sdk-testcontainers";
import type { TestProject } from "vitest/node";
export let restateServerContainer: RestateTestEnvironment;
declare module "vitest" {
    export interface ProvidedContext {
        RESTATE_ADMIN_URL: string;
        RESTATE_INGRESS_URL: string;
    }
}
export async function setup(project: TestProject) {
    restateServerContainer = await RestateTestEnvironment.start(() => {});
    process.env.RESTATE_ADMIN_URL = restateServerContainer.adminAPIBaseUrl();
    project.provide("RESTATE_ADMIN_URL", process.env.RESTATE_ADMIN_URL);
    project.provide("RESTATE_INGRESS_URL", restateServerContainer.baseUrl());
}
export async function teardown() {
    if (restateServerContainer) {
        console.log("Stopping restate server container");
        await restateServerContainer.stop();
    }
}
