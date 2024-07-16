import { describe } from "bun:test";
import { expect, test } from "bun:test";
import { SERVICE_NAME, supertest } from "./setup";
import { randomUUID } from "node:crypto";
import  request  from "supertest";
describe("Restate Server",() => {
    test("Check health", async () => {
        await request(`http://${process.env.RESTATE_HOST}:9070`).get("/health").expect(200);
    });
});
describe("Web2Text Service", () => {
    test("Check status endpoint", async () => {
        const expectedResponse = {Status: "NONEXISTANT"};
        const leadID = randomUUID();
        await supertest.get(`/${SERVICE_NAME}/${leadID}/status`).expect(200).expect("Content-Type","application/json").expect(JSON.stringify(expectedResponse));
    });
    test("Check create endpoint", async () => {
        const leadID = randomUUID();
        await supertest.get(`/${SERVICE_NAME}/${leadID}/create`).expect((resp) => resp.status !== 404 && resp.status !== 500).expect("Content-Type","application/json");
    });
    test("Check sync endpoint", async () => {
        const leadID = randomUUID();
        await supertest.get(`/${SERVICE_NAME}/${leadID}/sync`).expect((resp) => resp.status !== 404 && resp.status !== 500).expect("Content-Type","application/json");
    });
})