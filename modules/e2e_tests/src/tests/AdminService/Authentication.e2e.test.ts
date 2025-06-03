import { randomUUID } from "node:crypto";
import { APIKeyModel } from "common/dynamodb";
import { describe, test } from "vitest";
import { ADMIN_SERVICE_NAME } from "../../globalSetup";
import { supertest, TEST_API_KEY } from "../../setup";

describe("Admin Service Authentication", () => {
    for (const endpoint of ["bulk"]) {
        test(`${endpoint} should require authentication header`, async () => {
            await supertest
                .post(`/${ADMIN_SERVICE_NAME}/${endpoint}`)
                .send({
                    Operation: "FIND",
                    Filter: "*",
                })
                .expect(401);
        });
        test(`${endpoint} should not allow invalid API keys`, async () => {
            await supertest
                .post(`/${ADMIN_SERVICE_NAME}/${endpoint}`)
                .send({
                    Operation: "FIND",
                    Filter: "*",
                })
                .auth(randomUUID(), { type: "bearer" })
                .expect(401);
        });
        test(`${endpoint} should not allow malformed Authentication headers`, async () => {
            await supertest
                .post(`/${ADMIN_SERVICE_NAME}/${endpoint}`)
                .send({
                    Operation: "FIND",
                    Filter: "*",
                })
                .auth("username", "password")
                .expect(401);
        });
        test(`${endpoint} should allow valid API keys`, async () => {
            await supertest
                .post(`/${ADMIN_SERVICE_NAME}/${endpoint}`)
                .send({
                    Operation: "FIND",
                    Filter: "*",
                })
                .auth(TEST_API_KEY, { type: "bearer" })
                .expect((s) => s.status !== 401);
        });
        test(`${endpoint} should allow API key when has authorized endpoint`, async () => {
            const apiKey = await APIKeyModel.create(
                {
                    API_Key: randomUUID(),
                    Active: true,
                    DateCreated: new Date().toISOString(),
                    AuthorizedEndpoints: [`${ADMIN_SERVICE_NAME}/${endpoint}/FIND`],
                    Description: `E2E Test API Key for ${endpoint}`,
                },
                { overwrite: true },
            );
            await supertest
                .post(`/${ADMIN_SERVICE_NAME}/${endpoint}`)
                .send({
                    Operation: "FIND",
                    Filter: "*",
                })
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
                .send({
                    Operation: "FIND",
                    Filter: "*",
                })
                .auth(apiKey.API_Key, { type: "bearer" })
                .expect((s) => s.status === 401);
        });
    }
});
