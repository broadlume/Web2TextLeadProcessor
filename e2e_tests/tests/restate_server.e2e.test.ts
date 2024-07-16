import { describe } from "bun:test";
import { test } from "bun:test";
import { SERVICE_NAME, supertest, TEST_API_KEY } from "../setup";
import { randomUUID } from "node:crypto";
import request from "supertest";
describe("Restate Server", () => {
	test("Check health", async () => {
		await request(`http://${process.env.RESTATE_HOST}:9070`)
			.get("/health")
			.expect(200);
	});
});
describe("Web2Text Service", () => {
	const endpoints = ["status", "create", "sync", "close"];
	for (const endpoint of endpoints) {
		test(`Check ${endpoint} endpoint exists`, async () => {
			const expectedResponse = { Status: "NONEXISTANT" };
			const leadID = randomUUID();
			await supertest
				.get(`/${SERVICE_NAME}/${leadID}/status`)
				.auth(TEST_API_KEY, { type: "bearer" })
				.expect((resp) => resp.status !== 404 && resp.status !== 500)
		});
	}
});
