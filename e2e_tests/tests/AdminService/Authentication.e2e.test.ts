import { describe, test } from "vitest";
import { randomUUID } from "node:crypto";
import { supertest, TEST_API_KEY } from "../../setup";
import { APIKeyModel } from "../../../src/dynamodb/APIKeyModel";
import {
	ADMIN_SERVICE_NAME,
} from "../../globalSetup";
describe("Admin Service Authentication", () => {
	for (const endpoint of ["bulk"]) {
		test(`${endpoint}: should require authentication header`, async () => {
			await supertest
				.post(`/${ADMIN_SERVICE_NAME}/${endpoint}`)
				.send({})
				.expect(401);
		});
		test(`${endpoint} should not allow invalid API keys`, async () => {
			await supertest
				.post(`/${ADMIN_SERVICE_NAME}/${endpoint}`)
				.send({})
				.auth(randomUUID(), { type: "bearer" })
				.expect(401);
		});
		test(`${endpoint} should not allow malformed Authentication headers`, async () => {
			await supertest
				.post(`/${ADMIN_SERVICE_NAME}/${endpoint}`)
				.send({})
				.auth("username", "password")
				.expect(401);
		});
		test(`${endpoint} should allow valid API keys`, async () => {
			await supertest
				.post(`/${ADMIN_SERVICE_NAME}/${endpoint}`)
				.send({})
				.auth(TEST_API_KEY, { type: "bearer" })
				.expect((s) => s.status !== 401);
		});
		test(`${endpoint} should allow API key when has authorized endpoint`, async () => {
			const apiKey = await APIKeyModel.create(
				{
					API_Key: randomUUID(),
					Active: true,
					DateCreated: new Date().toISOString(),
					AuthorizedEndpoints: [`${ADMIN_SERVICE_NAME}/${endpoint}`],
					Description: `E2E Test API Key for ${endpoint}`,
				},
				{ overwrite: true },
			);
			await supertest
				.post(`/${ADMIN_SERVICE_NAME}/${endpoint}`)
				.send({})
				.auth(apiKey.API_Key, { type: "bearer" })
				.expect((s) => s.status !== 401);
		});
		test(`${endpoint} should not allow API key when no authorized endpoint`, async () => {
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
				.post(`/${ADMIN_SERVICE_NAME}/${endpoint}`)
				.send({})
				.auth(apiKey.API_Key, { type: "bearer" })
				.expect((s) => s.status === 401);
		});
	}
});
