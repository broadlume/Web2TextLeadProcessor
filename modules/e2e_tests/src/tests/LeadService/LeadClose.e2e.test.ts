import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createRandomLeadRequest, createRandomActOnLeadRequest } from "../../faker/Lead";
import { supertest, TEST_API_KEY } from "../../setup";

describe("Lead Close E2E Tests", () => {
    describe("Web2Text Lead Closing", () => {
        it("should close a lead successfully", async () => {
            const leadId = randomUUID();
        const request = createRandomLeadRequest({ SyncImmediately: false });
        // Create a lead first
        const _createResponse = await supertest
            .post(`/Lead/${leadId}/create`)
            .auth(TEST_API_KEY, { type: "bearer" })
            .send(request)
            .expect(200);

        // Close the lead
        const closeResponse = await supertest
            .post(`/Lead/${leadId}/close`)
            .auth(TEST_API_KEY, { type: "bearer" })
            .send({ reason: "Test close reason" })
            .expect(200);

        expect(closeResponse.body).toMatchObject({
            LeadId: leadId,
            Status: "CLOSED",
            CloseReason: "Test close reason",
        });
    });
        it("should successfully close integrations on lead close", async () => {
            const leadId = randomUUID();
        const request = createRandomLeadRequest({ SyncImmediately: false });
        // Create a lead first
        await supertest.post(`/Lead/${leadId}/create`).auth(TEST_API_KEY, { type: "bearer" }).send(request).expect(200);

        // Sync the lead
        await supertest.post(`/Lead/${leadId}/sync`).auth(TEST_API_KEY, { type: "bearer" }).expect(200);

        // Close the lead
        const closeResponse = await supertest
            .post(`/Lead/${leadId}/close`)
            .auth(TEST_API_KEY, { type: "bearer" })
            .send({ reason: "Test close reason" })
            .expect(200);

        expect(closeResponse.body).toMatchObject({
            LeadId: leadId,
            Status: "CLOSED",
            CloseReason: "Test close reason",
        });
        expect(closeResponse.body).to.have.property("Integrations");
        expect(Object.keys(closeResponse.body.Integrations).length === 1);
        for (const [_integration, state] of Object.entries(closeResponse.body.Integrations)) {
            expect((state as any).SyncStatus === "CLOSED");
        }
    });

        it("should return 409 when trying to close a non-existent lead", async () => {
            const leadId = randomUUID();
        await supertest
            .post(`/Lead/${leadId}/close`)
            .auth(TEST_API_KEY, { type: "bearer" })
            .send({ reason: "Test close reason" })
            .expect(409);
        });
    });

    describe("ActOn Lead Closing", () => {
        it("should close an ActOn lead successfully", async () => {
            const leadId = randomUUID();
            const request = createRandomActOnLeadRequest({ SyncImmediately: false });
            
            // Create a lead first
            const _createResponse = await supertest
                .post(`/Lead/${leadId}/create`)
                .auth(TEST_API_KEY, { type: "bearer" })
                .send(request)
                .expect(200);

            // Close the lead
            const closeResponse = await supertest
                .post(`/Lead/${leadId}/close`)
                .auth(TEST_API_KEY, { type: "bearer" })
                .send({ reason: "Test completed" })
                .expect(200);

            expect(closeResponse.body).toMatchObject({
                LeadId: leadId,
                Status: "CLOSED",
                CloseReason: "Test completed",
            });
        });

        it("should successfully close ActOn integrations on lead close", async () => {
            const leadId = randomUUID();
            const request = createRandomActOnLeadRequest({ SyncImmediately: false });
            
            // Create a lead first
            await supertest
                .post(`/Lead/${leadId}/create`)
                .auth(TEST_API_KEY, { type: "bearer" })
                .send(request)
                .expect(200);

            // Sync the lead
            await supertest
                .post(`/Lead/${leadId}/sync`)
                .auth(TEST_API_KEY, { type: "bearer" })
                .expect(200);

            // Close the lead
            const closeResponse = await supertest
                .post(`/Lead/${leadId}/close`)
                .auth(TEST_API_KEY, { type: "bearer" })
                .send({ reason: "Test completed" })
                .expect(200);

            expect(closeResponse.body).toMatchObject({
                LeadId: leadId,
                Status: "CLOSED",
                CloseReason: "Test completed",
            });
            expect(closeResponse.body).to.have.property("Integrations");
            expect(Object.keys(closeResponse.body.Integrations).length).toBeGreaterThan(0);
            for (const [_integration, state] of Object.entries(closeResponse.body.Integrations)) {
                expect((state as any).SyncStatus === "CLOSED");
            }
        });

        it("should close ActOn lead after immediate sync", async () => {
            const leadId = randomUUID();
            const request = createRandomActOnLeadRequest({ SyncImmediately: true });
            
            // Create and immediately sync a lead
            await supertest
                .post(`/Lead/${leadId}/create`)
                .auth(TEST_API_KEY, { type: "bearer" })
                .send(request)
                .expect(200);

            // Verify lead status
            await supertest
                .get(`/Lead/${leadId}/status`)
                .auth(TEST_API_KEY, { type: "bearer" })
                .expect(200)
                .expect((resp) => resp.body["Status"] === "ACTIVE");

            // Close the lead
            const closeResponse = await supertest
                .post(`/Lead/${leadId}/close`)
                .auth(TEST_API_KEY, { type: "bearer" })
                .send({ reason: "Test completed" })
                .expect(200);

            expect(closeResponse.body).toMatchObject({
                LeadId: leadId,
                Status: "CLOSED",
                CloseReason: "Test completed",
            });

            // Verify lead is closed
            await supertest
                .get(`/Lead/${leadId}/status`)
                .auth(TEST_API_KEY, { type: "bearer" })
                .expect(200)
                .expect((resp) => resp.body["Status"] === "CLOSED");
        });
    });
});
