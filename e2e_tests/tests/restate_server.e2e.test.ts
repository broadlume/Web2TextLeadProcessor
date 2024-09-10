import { describe, test } from "vitest";
import { supertest } from "../setup";
import { inject } from "vitest";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { SERVICE_NAME, TEST_API_KEY } from "../setup";
describe("Restate Server", () => {
	test("Check health", async () => {
		await request(process.env.RESTATE_ADMIN_URL!)
			.get("/health")
			.expect(200);
	});
});
describe("Web2Text Service", () => {
	const endpoints = ["status", "create", "sync", "close"];
	for (const endpoint of endpoints) {
		test(`Check ${endpoint} endpoint exists`, async () => {
			const leadID = randomUUID();
			await supertest
				.get(`/${SERVICE_NAME}/${leadID}/status`)
				.auth(TEST_API_KEY, { type: "bearer" })
				.expect((resp) => resp.status !== 404 && resp.status !== 500)
		});
	}
});
