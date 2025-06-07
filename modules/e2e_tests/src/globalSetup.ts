import { RestateTestEnvironment } from "@restatedev/restate-sdk-testcontainers";
import { GenericContainer, type StartedTestContainer } from "testcontainers";
import type { TestProject } from "vitest/node";
export let restateServerContainer: RestateTestEnvironment;
export let dynamodbServerContainer: StartedTestContainer;
declare module "vitest" {
    export interface ProvidedContext {
        RESTATE_ADMIN_URL: string;
        RESTATE_INGRESS_URL: string;
        LOCAL_DYNAMODB_URL: string;
    }
}
export async function setup(project: TestProject) {
    console.log("Starting restate server container");
    restateServerContainer = await RestateTestEnvironment.start(() => {});
    process.env.RESTATE_ADMIN_URL = restateServerContainer.adminAPIBaseUrl();

    console.log("Starting dynamodb server container");
    dynamodbServerContainer = await new GenericContainer("amazon/dynamodb-local").withExposedPorts(8000).start();

    // Provide the environment variables to the test project
    project.provide("RESTATE_ADMIN_URL", restateServerContainer.adminAPIBaseUrl());
    project.provide("RESTATE_INGRESS_URL", restateServerContainer.baseUrl());
    project.provide(
        "LOCAL_DYNAMODB_URL",
        `http://${dynamodbServerContainer.getHost()}:${dynamodbServerContainer.getMappedPort(8000)}`,
    );
}
export async function teardown() {
    if (restateServerContainer) {
        console.log("Stopping restate server container");
        await restateServerContainer.stop();
    }
    if (dynamodbServerContainer) {
        console.log("Stopping dynamodb server container");
        await dynamodbServerContainer.stop();
    }
}
