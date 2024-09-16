import { describe, inject, test } from "vitest";
import { supertest } from "../setup";
import { SERVICE_NAME, TEST_API_KEY } from "../setup";
import { randomUUID } from "node:crypto";
describe("Authentication", () => {
	const endpoints = ["status", "create", "sync", "close"];
	for (const endpoint of endpoints) {
		test(`${endpoint}: should require authentication header`, async () => {
			const leadID = randomUUID();
			await supertest
				.post(`/${SERVICE_NAME}/${leadID}/${endpoint}`)
				.send({})
				.expect(401);
		});
		test(`${endpoint} should not allow invalid API keys`, async () => {
			const leadID = randomUUID();
			await supertest
				.post(`/${SERVICE_NAME}/${leadID}/${endpoint}`)
				.send({})
				.auth(randomUUID(), { type: "bearer" })
				.expect(401);
		});
        test(`${endpoint} should not allow malformed Authentication headers`, async () => {
			const leadID = randomUUID();
			await supertest
				.post(`/${SERVICE_NAME}/${leadID}/${endpoint}`)
				.send({}).auth("username","password")
				.expect(401);
		});
        test(`${endpoint} should allow valid API keys`, async () => {
            const leadID = randomUUID();
			await supertest
				.post(`/${SERVICE_NAME}/${leadID}/${endpoint}`)
				.send({})
				.auth(TEST_API_KEY, { type: "bearer" })
				.expect(200);
        })
	}
});
