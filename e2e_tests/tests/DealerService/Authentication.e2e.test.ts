import { randomUUID } from "node:crypto";
import nock from "nock";
import { describe, test } from "vitest";
import { DEALER_SERVICE_NAME } from "../../globalSetup";
import { TEST_API_KEY, supertest } from "../../setup";
import { APIKeyModel } from "../../../src/web2text/dynamodb/APIKeyModel";
describe("Dealer Service Authentication", () => {
	for (const endpoint of ["status"]) {
		test(`${endpoint} should require authentication header`, async () => {
			const universalRetailerId = randomUUID();
			await supertest
				.get(`/${DEALER_SERVICE_NAME}/${universalRetailerId}/${endpoint}`)
				.expect(401);
		});
		test(`${endpoint} should not allow invalid API keys`, async () => {
			const universalRetailerId = randomUUID();
			await supertest
				.get(`/${DEALER_SERVICE_NAME}/${universalRetailerId}/${endpoint}`)
				.auth(randomUUID(), { type: "bearer" })
				.expect(401);
		});
		test(`${endpoint} should not allow malformed Authentication headers`, async () => {
			const universalRetailerId = randomUUID();
			await supertest
				.get(`/${DEALER_SERVICE_NAME}/${universalRetailerId}/${endpoint}`)
				.auth("username", "password")
				.expect(401);
		});
		test(`${endpoint} should allow valid API keys`, async () => {
			const universalRetailerId = randomUUID();
			nock(process.env.NEXUS_API_URL!)
				.get(`/retailers/${universalRetailerId}`)
				.reply(404, {});

			await supertest
				.get(`/${DEALER_SERVICE_NAME}/${universalRetailerId}/${endpoint}`)
				.auth(TEST_API_KEY, { type: "bearer" })
				.expect((s) => s.status !== 401);
		});
		test(`${endpoint} should allow API key when has authorized endpoint`, async () => {
			const universalRetailerId = randomUUID();
			nock(process.env.NEXUS_API_URL!)
				.get(`/retailers/${universalRetailerId}`)
				.reply(404, {});
			const apiKey = await APIKeyModel.create(
				{
					API_Key: randomUUID(),
					Active: true,
					DateCreated: new Date().toISOString(),
					AuthorizedEndpoints: [`${DEALER_SERVICE_NAME}/${endpoint}`],
					Description: `E2E Test API Key for ${endpoint}`,
				},
				{ overwrite: true },
			);
			await supertest
				.get(`/${DEALER_SERVICE_NAME}/${universalRetailerId}/${endpoint}`)
				.auth(apiKey.API_Key, { type: "bearer" })
				.expect((s) => s.status !== 401);
		});
		test(`${endpoint} should not allow API key when no authorized endpoint`, async () => {
			const universalRetailerId = randomUUID();
			const apiKey = await APIKeyModel.create(
				{
					API_Key: randomUUID(),
					Active: true,
					DateCreated: new Date().toISOString(),
					AuthorizedEndpoints: ["Random/Endpoint", "Random2/Endpoint2"],
					Description: `E2E Test API Key for ${endpoint}`,
				},
				{ overwrite: true },
			);
			await supertest
				.get(`/${DEALER_SERVICE_NAME}/${universalRetailerId}/${endpoint}`)
				.auth(apiKey.API_Key, { type: "bearer" })
				.expect((s) => s.status === 401);
		});
	}
});
