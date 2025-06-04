import { randomUUID } from "node:crypto";
import { APIKeyModel } from "common/dynamodb";
import { HttpResponse, http } from "msw";
import { mockServer } from "src/mock/server";
import { describe, test } from "vitest";
import { supertest, TEST_API_KEY } from "../../setup";

describe("Dealer Service Authentication", () => {
    for (const endpoint of ["status"]) {
        test(`${endpoint} should require authentication header`, async () => {
            const universalRetailerId = randomUUID();
            await supertest.get(`/Dealer/${universalRetailerId}/${endpoint}`).expect(401);
        });
        test(`${endpoint} should not allow invalid API keys`, async () => {
            const universalRetailerId = randomUUID();
            await supertest
                .get(`/Dealer/${universalRetailerId}/${endpoint}`)
                .auth(randomUUID(), { type: "bearer" })
                .expect(401);
        });
        test(`${endpoint} should not allow malformed Authentication headers`, async () => {
            const universalRetailerId = randomUUID();
            await supertest.get(`/Dealer/${universalRetailerId}/${endpoint}`).auth("username", "password").expect(401);
        });
        test(`${endpoint} should allow valid API keys`, async () => {
            const universalRetailerId = randomUUID();
            await mockServer.boundary(async () => {
                mockServer.use(
                    http.get(`${process.env.NEXUS_API_URL}/retailers/${universalRetailerId}`, () => {
                        return HttpResponse.json({ status: "Active" }, { status: 200 });
                    }),
                );
                return await supertest
                    .get(`/Dealer/${universalRetailerId}/${endpoint}`)
                    .auth(TEST_API_KEY, { type: "bearer" })
                    .expect((s) => s.status !== 401);
            })();
        });
        test(`${endpoint} should allow API key when has authorized endpoint`, async () => {
            const universalRetailerId = randomUUID();
            const apiKey = await APIKeyModel.create(
                {
                    API_Key: randomUUID(),
                    Active: true,
                    DateCreated: new Date().toISOString(),
                    AuthorizedEndpoints: [`/Dealer/${endpoint}`],
                    Description: `E2E Test API Key for ${endpoint}`,
                },
                { overwrite: true },
            );
            await mockServer.boundary(async () => {
                mockServer.use(
                    http.get(`${process.env.NEXUS_API_URL}/retailers/${universalRetailerId}`, () => {
                        return HttpResponse.json({ status: "Active" }, { status: 200 });
                    }),
                );
                return await supertest
                    .get(`/Dealer/${universalRetailerId}/${endpoint}`)
                    .auth(apiKey.API_Key, { type: "bearer" })
                    .expect((s) => s.status !== 401);
            })();
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
                .get(`/Dealer/${universalRetailerId}/${endpoint}`)
                .auth(apiKey.API_Key, { type: "bearer" })
                .expect((s) => s.status === 401);
        });
    }
});
