import { describe, inject, test } from "vitest";
import { supertest } from "../setup";
import { TEST_API_KEY } from "../setup";
import { randomUUID } from "node:crypto";
import { DEALER_SERVICE_NAME, LEAD_SERVICE_NAME } from '../globalSetup';
const SERVICE_ENDPOINTS = {
	[DEALER_SERVICE_NAME]: ["status"],
	[LEAD_SERVICE_NAME]: ["status", "create", "sync", "close"]
}
for (const service of Object.keys(SERVICE_ENDPOINTS)) {
	describe(`${service.replace("-test","")} Service Authentication`, () => {
		for (const endpoint of SERVICE_ENDPOINTS[service]) {
			test(`${endpoint}: should require authentication header`, async () => {
				const leadID = randomUUID();
				await supertest
					.post(`/${LEAD_SERVICE_NAME}/${leadID}/${endpoint}`)
					.send({})
					.expect(401);
			});
			test(`${endpoint} should not allow invalid API keys`, async () => {
				const leadID = randomUUID();
				await supertest
					.post(`/${LEAD_SERVICE_NAME}/${leadID}/${endpoint}`)
					.send({})
					.auth(randomUUID(), { type: "bearer" })
					.expect(401);
			});
			test(`${endpoint} should not allow malformed Authentication headers`, async () => {
				const leadID = randomUUID();
				await supertest
					.post(`/${LEAD_SERVICE_NAME}/${leadID}/${endpoint}`)
					.send({}).auth("username","password")
					.expect(401);
			});
			test(`${endpoint} should allow valid API keys`, async () => {
				const leadID = randomUUID();
				await supertest
					.post(`/${LEAD_SERVICE_NAME}/${leadID}/${endpoint}`)
					.send({})
					.auth(TEST_API_KEY, { type: "bearer" })
					.expect(s => s.status !== 401);
			})
		}
	});
}

