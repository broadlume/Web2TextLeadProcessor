import { randomUUID } from "node:crypto";
import { findNumbers } from "libphonenumber-js";
import nock from "nock";
import { createRandomLeadRequest } from "src/faker/Lead";
import { v4 as uuidv4 } from "uuid";
import { beforeAll, describe, test } from "vitest";
import { LEAD_SERVICE_NAME } from "../../globalSetup";
import { supertest, TEST_API_KEY } from "../../setup";

const INVALID_LOCATION_ID = "e994392b-5a6f-473f-85f8-dd715048fe29";
const INVALID_UNIVERSAL_RETAILER_ID = "e994392b-5a6f-473f-85f8-dd715048fe29";
describe("Lead Creation", () => {
    beforeAll(() => {
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
                const locationId = new URL(uri, "https://example.com").searchParams.get("location_id");
                if (locationId === INVALID_LOCATION_ID) {
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
    test("Successful lead creation", async () => {
        const leadID = randomUUID();
        const request = createRandomLeadRequest({ SyncImmediately: false });
        await supertest
            .post(`/${LEAD_SERVICE_NAME}/${leadID}/create`)
            .auth(TEST_API_KEY, { type: "bearer" })
            .send(request)
            .expect(200)
            .expect((resp) => resp.body["Status"] === "ACTIVE");
        await supertest
            .get(`/${LEAD_SERVICE_NAME}/${leadID}/status`)
            .auth(TEST_API_KEY, { type: "bearer" })
            .expect(200)
            .expect((resp) => resp.body["Status"] === "ACTIVE");
    });

    test("Lead creation with invalid UniversalRetailerId", async () => {
        const leadID = randomUUID();
        const request = createRandomLeadRequest({ SyncImmediately: false });
        request.UniversalRetailerId = INVALID_UNIVERSAL_RETAILER_ID;
        await supertest
            .post(`/${LEAD_SERVICE_NAME}/${leadID}/create`)
            .auth(TEST_API_KEY, { type: "bearer" })
            .send(request)
            .expect(400);
    });

    test("Lead creation with invalid LocationId", async () => {
        const leadID = randomUUID();
        const request = createRandomLeadRequest({ SyncImmediately: false });
        request.Lead.LocationId = "e994392b-5a6f-473f-85f8-dd715048fe29";

        await supertest
            .post(`/${LEAD_SERVICE_NAME}/${leadID}/create`)
            .auth(TEST_API_KEY, { type: "bearer" })
            .send(request)
            .expect(400);
    });

    test("Lead creation with invalid phone number", async () => {
        const leadID = randomUUID();
        const request = createRandomLeadRequest({ SyncImmediately: false });
        const invalidLead = {
            ...request,
            Lead: { ...request.Lead, PhoneNumber: "invalid-phone" },
        };
        await supertest
            .post(`/${LEAD_SERVICE_NAME}/${leadID}/create`)
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
            .post(`/${LEAD_SERVICE_NAME}/${leadID}/create`)
            .auth(TEST_API_KEY, { type: "bearer" })
            .send(incompleteLead)
            .expect(400);
    });

    test("Duplicate lead creation", async () => {
        const leadID = randomUUID();
        const request = createRandomLeadRequest({ SyncImmediately: false });
        await supertest
            .post(`/${LEAD_SERVICE_NAME}/${leadID}/create`)
            .auth(TEST_API_KEY, { type: "bearer" })
            .send(request)
            .expect(200);
        await supertest
            .post(`/${LEAD_SERVICE_NAME}/${leadID}/create`)
            .auth(TEST_API_KEY, { type: "bearer" })
            .send(request)
            .expect(409);
    });
});
