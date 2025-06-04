import { randomUUID } from "node:crypto";
import { createRandomLeadRequest } from "src/faker/Lead";
import { describe, test } from "vitest";
import { supertest, TEST_API_KEY } from "../../setup";

describe("Lead Creation", () => {
    test("Successful lead creation", async () => {
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

    test("Lead creation with invalid UniversalRetailerId", async () => {
        const leadID = randomUUID();
        const request = createRandomLeadRequest({ SyncImmediately: false });

        request.UniversalRetailerId = INVALID_UNIVERSAL_RETAILER_ID;
        await supertest.post(`/Lead/${leadID}/create`).auth(TEST_API_KEY, { type: "bearer" }).send(request).expect(400);
    });

    test("Lead creation with invalid LocationId", async () => {
        const leadID = randomUUID();
        const request = createRandomLeadRequest({ SyncImmediately: false });
        request.Lead.LocationId = "e994392b-5a6f-473f-85f8-dd715048fe29";

        await supertest.post(`/Lead/${leadID}/create`).auth(TEST_API_KEY, { type: "bearer" }).send(request).expect(400);
    });

    test("Lead creation with invalid phone number", async () => {
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

    test("Lead creation with missing required fields", async () => {
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

    test("Duplicate lead creation", async () => {
        const leadID = randomUUID();
        const request = createRandomLeadRequest({ SyncImmediately: false });
        await supertest.post(`/Lead/${leadID}/create`).auth(TEST_API_KEY, { type: "bearer" }).send(request).expect(200);
        await supertest.post(`/Lead/${leadID}/create`).auth(TEST_API_KEY, { type: "bearer" }).send(request).expect(409);
    });
});
