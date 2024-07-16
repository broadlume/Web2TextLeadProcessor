import {beforeAll, beforeEach, afterAll} from "bun:test"
import {$, type Server} from "bun"
import * as restateFetch from "@restatedev/restate-sdk/fetch"
import { LeadVirtualObject } from '../src/restate/LeadVirtualObject';
import request from 'supertest';
import dynamoose from 'dynamoose';
export let TEST_SERVER: Server;
export const supertest = request(`http://${process.env.RESTATE_HOST}:8080/`);
export const SERVICE_NAME = "Lead-test";
beforeAll(async () => {
    dynamoose.aws.ddb.local(process.env.LOCAL_DYNAMODB_URL);
    Object.assign(LeadVirtualObject,{name: SERVICE_NAME});
    // Setup restate handler as an HTTP1 handler (Bun doesn't support HTTP2 servers yet)
    const handler = restateFetch.endpoint().bind(LeadVirtualObject).handler();
    TEST_SERVER = Bun.serve({
        port: 9075,
        ...handler
    });
    // Register the service and clear ports
    await $`bun run register-with-restate -- --use-http1.1`.quiet().then(() => {
        console.info("Registered test service with Restate server");
    });
})
beforeEach(async () => {
    // Clear the state between each test
    await $`bun run clear-restate-test`.quiet();
})

afterAll(async () => {
    await $`bun run clear-restate-test`.quiet();
    // De register the deployment
    const table = await $`restate services list`.text();
    const deploymentId = /dp_[a-zA-z\d]+/.exec(table)?.[0];
    if (deploymentId != null) {
        await $`restate deployments remove ${deploymentId} --force --yes`.quiet();
    }
})