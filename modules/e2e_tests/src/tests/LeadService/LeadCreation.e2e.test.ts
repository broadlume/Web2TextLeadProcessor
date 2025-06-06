import { randomUUID } from "node:crypto";
import { describe, test } from "vitest";
import { createRandomActOnLeadRequest, createRandomLeadRequest } from "../../faker/Lead";
import { supertest, TEST_API_KEY } from "../../setup";

describe("Lead Creation", () => {
    describe("Web2Text Lead Creation", () => {
        test("Successful Web2Text lead creation", async () => {
            const leadID = randomUUID();
            const request = createRandomLeadRequest({ SyncImmediately: false });
            await supertest
                .post(`/Lead/${leadID}/create`)
                .auth(TEST_API_KEY, { type: "bearer" })
                .send(request)
                .expect(200)
                .expect((resp) => resp.body["Status"] === "ACTIVE");
            await supertest
                .get(`/Lead/${leadID}/status`)
                .auth(TEST_API_KEY, { type: "bearer" })
                .expect(200)
                .expect((resp) => resp.body["Status"] === "ACTIVE");
        });

        test("Web2Text lead creation with invalid UniversalRetailerId", async () => {
            const leadID = randomUUID();
            const request = createRandomLeadRequest({ SyncImmediately: false });

            request.UniversalRetailerId = "invalid-uuid" as any;
            await supertest
                .post(`/Lead/${leadID}/create`)
                .auth(TEST_API_KEY, { type: "bearer" })
                .send(request)
                .expect(400);
        });

        test("Web2Text lead creation with invalid LocationId", async () => {
            const leadID = randomUUID();
            const request = createRandomLeadRequest({ SyncImmediately: false });
            request.Lead.LocationId = "00000000-0000-0000-0000-000000000000" as any;

            await supertest
                .post(`/Lead/${leadID}/create`)
                .auth(TEST_API_KEY, { type: "bearer" })
                .send(request)
                .expect(400);
        });

        test("Web2Text lead creation with invalid phone number", async () => {
            const leadID = randomUUID();
            const request = createRandomLeadRequest({ SyncImmediately: false });
            const invalidLead = {
                ...request,
                Lead: { ...request.Lead, PhoneNumber: "invalid-phone" },
            };
            await supertest
                .post(`/Lead/${leadID}/create`)
                .auth(TEST_API_KEY, { type: "bearer" })
                .send(invalidLead)
                .expect(400);
        });

        test("Web2Text lead creation with missing required fields", async () => {
            const leadID = randomUUID();
            const request = createRandomLeadRequest({ SyncImmediately: false });
            const incompleteLead = {
                UniversalRetailerId: request.UniversalRetailerId,
                Lead: {
                    LocationId: request.Lead.LocationId,
                    PageUrl: request.Lead.PageUrl,
                    IPAddress: request.Lead.IPAddress,
                },
            };
            await supertest
                .post(`/Lead/${leadID}/create`)
                .auth(TEST_API_KEY, { type: "bearer" })
                .send(incompleteLead)
                .expect(400);
        });

        test("Duplicate Web2Text lead creation", async () => {
            const leadID = randomUUID();
            const request = createRandomLeadRequest({ SyncImmediately: false });
            await supertest
                .post(`/Lead/${leadID}/create`)
                .auth(TEST_API_KEY, { type: "bearer" })
                .send(request)
                .expect(200);
            await supertest
                .post(`/Lead/${leadID}/create`)
                .auth(TEST_API_KEY, { type: "bearer" })
                .send(request)
                .expect(409);
        });
    });

    describe("ActOn Lead Creation", () => {
        test("Successful ActOn lead creation", async () => {
            const leadID = randomUUID();
            const request = createRandomActOnLeadRequest({ SyncImmediately: false });

            await supertest
                .post(`/Lead/${leadID}/create`)
                .auth(TEST_API_KEY, { type: "bearer" })
                .send(request)
                .expect(200)
                .expect((resp) => resp.body["Status"] === "ACTIVE");

            await supertest
                .get(`/Lead/${leadID}/status`)
                .auth(TEST_API_KEY, { type: "bearer" })
                .expect(200)
                .expect((resp) => resp.body["Status"] === "ACTIVE");
        });

        test("ActOn lead creation with immediate sync", async () => {
            const leadID = randomUUID();
            const request = createRandomActOnLeadRequest({ SyncImmediately: true });

            await supertest
                .post(`/Lead/${leadID}/create`)
                .auth(TEST_API_KEY, { type: "bearer" })
                .send(request)
                .expect(200)
                .expect((resp) => resp.body["Status"] === "ACTIVE");

            await supertest
                .get(`/Lead/${leadID}/status`)
                .auth(TEST_API_KEY, { type: "bearer" })
                .expect(200)
                .expect((resp) => resp.body["Status"] === "SYNCING");
        });

        test("ActOn lead creation with missing required fields", async () => {
            const leadID = randomUUID();
            const request = createRandomActOnLeadRequest({ SyncImmediately: false });

            // Remove required fields
            const incompleteLead = {
                ...request,
                Lead: {
                    ...request.Lead,
                    "First Name": undefined,
                    "Last Name": undefined,
                },
            };

            await supertest
                .post(`/Lead/${leadID}/create`)
                .auth(TEST_API_KEY, { type: "bearer" })
                .send(incompleteLead)
                .expect(400);
        });

        test("ActOn lead creation with invalid email", async () => {
            const leadID = randomUUID();
            const request = createRandomActOnLeadRequest({ SyncImmediately: false });

            const invalidLead = {
                ...request,
                Lead: {
                    ...request.Lead,
                    "E-mail Address": "invalid-email",
                },
            };

            await supertest
                .post(`/Lead/${leadID}/create`)
                .auth(TEST_API_KEY, { type: "bearer" })
                .send(invalidLead)
                .expect(400);
        });

        test("ActOn lead creation with missing postal code", async () => {
            const leadID = randomUUID();
            const request = createRandomActOnLeadRequest({ SyncImmediately: false });

            const invalidLead = {
                ...request,
                Lead: {
                    ...request.Lead,
                    "Home Postal Code": undefined,
                },
            };

            await supertest
                .post(`/Lead/${leadID}/create`)
                .auth(TEST_API_KEY, { type: "bearer" })
                .send(invalidLead)
                .expect(400);
        });

        test("Duplicate ActOn lead creation", async () => {
            const leadID = randomUUID();
            const request = createRandomActOnLeadRequest({ SyncImmediately: false });

            await supertest
                .post(`/Lead/${leadID}/create`)
                .auth(TEST_API_KEY, { type: "bearer" })
                .send(request)
                .expect(200);

            await supertest
                .post(`/Lead/${leadID}/create`)
                .auth(TEST_API_KEY, { type: "bearer" })
                .send(request)
                .expect(409);
        });

        test("ActOn lead with invalid UniversalRetailerId", async () => {
            const leadID = randomUUID();
            const request = createRandomActOnLeadRequest({ SyncImmediately: false });

            request.UniversalRetailerId = "invalid-uuid" as any;

            await supertest
                .post(`/Lead/${leadID}/create`)
                .auth(TEST_API_KEY, { type: "bearer" })
                .send(request)
                .expect(400);
        });
    });
});
