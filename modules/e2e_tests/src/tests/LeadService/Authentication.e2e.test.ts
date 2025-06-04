import { randomUUID } from "node:crypto";
import { APIKeyModel } from "common/dynamodb";
import { describe, test } from "vitest";
import { supertest, TEST_API_KEY } from "../../setup";

describe("Lead Service Authentication", () => {
    for (const endpoint of ["status", "create", "sync", "close"]) {
        test(`${endpoint} should require authentication header`, async () => {
            const leadID = randomUUID();
            await supertest.post(`/Lead/${leadID}/${endpoint}`).send({}).expect(401);
        });
        test(`${endpoint} should not allow invalid API keys`, async () => {
            const leadID = randomUUID();
            await supertest
                .post(`/Lead/${leadID}/${endpoint}`)
                .send({})
                .auth(randomUUID(), { type: "bearer" })
                .expect(401);
        });
        test(`${endpoint} should not allow malformed Authentication headers`, async () => {
            const leadID = randomUUID();
            await supertest.post(`/Lead/${leadID}/${endpoint}`).send({}).auth("username", "password").expect(401);
        });
        test(`${endpoint} should allow valid API keys`, async () => {
            const leadID = randomUUID();
            await supertest
                .post(`/Lead/${leadID}/${endpoint}`)
                .send({})
                .auth(TEST_API_KEY, { type: "bearer" })
                .expect((s) => s.status !== 401);
        });
        test(`${endpoint} should allow API key when has authorized endpoint`, async () => {
            const leadID = randomUUID();
            const apiKey = await APIKeyModel.create(
                {
                    API_Key: randomUUID(),
                    Active: true,
                    DateCreated: new Date().toISOString(),
                    AuthorizedEndpoints: [`/Lead/${endpoint}`],
                    Description: `E2E Test API Key for ${endpoint}`,
                },
                { overwrite: true },
            );
            await supertest
                .post(`/Lead/${leadID}/${endpoint}`)
                .send({})
                .auth(apiKey.API_Key, { type: "bearer" })
                .expect((s) => s.status !== 401);
        });
        test(`${endpoint} should not allow API key when no authorized endpoint`, async () => {
            const leadID = randomUUID();
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
                .post(`/Lead/${leadID}/${endpoint}`)
                .send({})
                .auth(apiKey.API_Key, { type: "bearer" })
                .expect((s) => s.status === 401);
        });
    }
});
