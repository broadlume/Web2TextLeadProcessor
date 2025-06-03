import { findNumbers } from "libphonenumber-js";
import nock from "nock";
import { createRandomLeadRequest } from "src/faker/Lead";
import { v4 as uuidv4 } from "uuid";
import { beforeEach, describe, expect, it } from "vitest";
import { LEAD_SERVICE_NAME } from "../../globalSetup";
import { supertest, TEST_API_KEY } from "../../setup";

const INVALID_LOCATION_ID = "e994392b-5a6f-473f-85f8-dd715048fe29";
const INVALID_UNIVERSAL_RETAILER_ID = "e994392b-5a6f-473f-85f8-dd715048fe29";
describe("Lead Close E2E Tests", () => {
    beforeEach(() => {
        const rlm_api_key = uuidv4();
        nock(process.env.NEXUS_API_URL!)
            .get(/retailers\/([^/]+)$/)
            .reply((uri) => {
                const retailerId = uri.replace("/retailers/", "");
                if (retailerId === INVALID_UNIVERSAL_RETAILER_ID) {
                    return [404];
                }
                return [
                    200,
                    {
                        id: retailerId,
                        name: "Test Client",
                        status: "Customer",
                        rlm_api_key: rlm_api_key,
                    },
                ];
            })
            .persist()
            .get(/retailers\/([^/]+)\/subscriptions$/)
            .reply((uri) => {
                const retailerId = uri.replace("/retailers/", "");
                if (retailerId === INVALID_UNIVERSAL_RETAILER_ID) {
                    return [404];
                }
                return [
                    200,
                    [
                        {
                            status: "Live",
                            web2text_opt_out: false,
                            subscription_status: "Live",
                        },
                    ],
                ];
            })
            .persist();

        nock(process.env.NEXUS_AWS_API_URL!)
            .get("/nexus/location")
            .query((query) => {
                return "location_id" in query && Object.keys(query).length === 1;
            })
            .reply((uri) => {
                const invalidLocationId = "e994392b-5a6f-473f-85f8-dd715048fe29";
                const locationId = new URL(uri, "https://example.com").searchParams.get("location_id");
                if (locationId === invalidLocationId) {
                    return [404];
                }
                return [
                    200,
                    {
                        data: [
                            {
                                id: locationId,
                                location_id: locationId,
                                Web2Text_Phone_Number: "+12246591932",
                            },
                        ],
                    },
                ];
            })
            .persist();
        nock("https://lookups.twilio.com")
            .get(/\/v2\/PhoneNumbers\/.*/)
            .query({
                Fields: "line_type_intelligence",
            })
            .reply(200, (uri) => ({
                calling_country_code: "1",
                country_code: "US",
                phone_number: findNumbers(uri)[0],
                valid: true,
                validation_errors: null,
                caller_name: null,
                sim_swap: null,
                call_forwarding: null,
                line_status: null,
                line_type_intelligence: {
                    error_code: null,
                    mobile_country_code: "240",
                    mobile_network_code: "38",
                    carrier_name: "Twilio - SMS/MMS-SVR",
                    type: "mobile",
                },
                identity_match: null,
                reassigned_number: null,
                sms_pumping_risk: null,
                phone_number_quality_score: null,
                pre_fill: null,
                url: "https://lookups.twilio.com/v2/PhoneNumbers/+14159929960",
            }))
            .persist();
        // Mock Twilio API calls
        nock("https://conversations.twilio.com")
            .persist()
            .post(/.*/)
            .reply(200, { sid: "test-conversation-sid" })
            .get(/.*/)
            .reply(200, { state: "active" })
            .patch(/.*/)
            .reply(200, { state: "closed" });

        // Mock RLM API calls
        nock("https://api.retailerleadmanagement.com")
            .persist()
            .post(/.*/)
            .reply(200, { result: "Success", lead_id: 12345, lead_uuid: uuidv4() });

        // Mock DHQ API calls
        nock("https://api.dhq.broadlume.com")
            .persist()
            .post(/.*/)
            .reply(200, { status: "success", data: { lead: { id: "dhq-lead-id" } } });
    });
    it("should close a lead successfully", async () => {
        const leadId = uuidv4();
        const request = createRandomLeadRequest({ SyncImmediately: false });
        // Create a lead first
        const createResponse = await supertest
            .post(`/${LEAD_SERVICE_NAME}/${leadId}/create`)
            .auth(TEST_API_KEY, { type: "bearer" })
            .send(request)
            .expect(200);

        // Close the lead
        const closeResponse = await supertest
            .post(`/${LEAD_SERVICE_NAME}/${leadId}/close`)
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
        const leadId = uuidv4();
        const request = createRandomLeadRequest({ SyncImmediately: false });
        // Create a lead first
        await supertest
            .post(`/${LEAD_SERVICE_NAME}/${leadId}/create`)
            .auth(TEST_API_KEY, { type: "bearer" })
            .send(request)
            .expect(200);

        // Sync the lead
        await supertest.post(`/${LEAD_SERVICE_NAME}/${leadId}/sync`).auth(TEST_API_KEY, { type: "bearer" }).expect(200);

        // Close the lead
        const closeResponse = await supertest
            .post(`/${LEAD_SERVICE_NAME}/${leadId}/close`)
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
        for (const [integration, state] of Object.entries(closeResponse.body.Integrations)) {
            expect((state as any).SyncStatus === "CLOSED");
        }
    });

    it("should return 409 when trying to close a non-existent lead", async () => {
        const leadId = uuidv4();
        await supertest
            .post(`/${LEAD_SERVICE_NAME}/${leadId}/close`)
            .auth(TEST_API_KEY, { type: "bearer" })
            .send({ reason: "Test close reason" })
            .expect(409);
    });
});
