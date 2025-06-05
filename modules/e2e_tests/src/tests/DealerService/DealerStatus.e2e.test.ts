import { HttpResponse, http } from "msw";
import { v4 as uuidv4 } from "uuid";
import { describe, expect, it } from "vitest";
import { NEXUS_FAKE_LOCATION_ID } from "../../mock/nexus/handlers";
import { mockServer } from "../../mock/server";
import { supertest, TEST_API_KEY } from "../../setup";

describe("DealerStatus E2E Tests", () => {
    it("should return VALID status for a valid dealer with valid locations", async () => {
        const mockUniversalRetailerId = uuidv4();
        const mockLocationId = uuidv4();

        await supertest
            .get(`/Dealer/${mockUniversalRetailerId}/status`)
            .auth(TEST_API_KEY, { type: "bearer" })
            .expect(200)
            .expect((res) => {
                expect(res.body).toEqual({
                    Status: "VALID",
                    Locations: [
                        {
                            CallTrackingPhoneNumber: "+1234567890",
                            City: "Test City",
                            Name: "Test Store",
                            NexusLocationId: expect.any(String),
                            State: "CA",
                            Status: "VALID",
                            StorePhoneNumber: "+1234567890",
                            StreetAddress: "123 Test St",
                            UniversalLocationId: expect.any(String),
                            Web2TextPhoneNumber: "+1234567890",
                            ZipCode: "12345",
                        },
                    ],
                });
            });
    });

    it("should return INVALID status for a churned dealer", async () => {
        const mockUniversalRetailerId = uuidv4();

        mockServer.use(
            http.get(`${process.env.NEXUS_API_URL}/retailers/${mockUniversalRetailerId}`, () => {
                return HttpResponse.json(
                    {
                        id: mockUniversalRetailerId,
                        name: "Test Client",
                        status: "Churned_Customer",
                        rlm_api_key: "test_api_key",
                    },
                    { status: 200 },
                );
            }),
            http.get(`${process.env.NEXUS_AWS_API_URL}/nexus/retailerLocations`, () => {
                return HttpResponse.json({ data: [] }, { status: 200 });
            }),
        );
        await supertest
            .get(`/Dealer/${mockUniversalRetailerId}/status`)
            .auth(TEST_API_KEY, { type: "bearer" })
            .expect(200)
            .expect((res) => {
                expect(res.body).toEqual({
                    Status: "INVALID",
                    Reason: "Nexus has flagged this retailer as a churned customer",
                });
            });
    });

    it("should return INVALID status for a dealer opted out of Web2Text", async () => {
        const mockUniversalRetailerId = uuidv4();
        mockServer.use(
            http.get(`${process.env.NEXUS_API_URL}/retailers/${mockUniversalRetailerId}`, () => {
                return HttpResponse.json(
                    {
                        id: mockUniversalRetailerId,
                        name: "Test Client",
                        status: "Customer",
                        rlm_api_key: "test_api_key",
                    },
                    { status: 200 },
                );
            }),
            http.get(`${process.env.NEXUS_API_URL}/retailers/${mockUniversalRetailerId}/subscriptions`, () => {
                return HttpResponse.json([{ status: "Active", web2text_opt_out: true }], { status: 200 });
            }),
            http.get(`${process.env.NEXUS_AWS_API_URL}/nexus/retailerLocations`, () => {
                return HttpResponse.json({ data: [] }, { status: 200 });
            }),
        );

        await supertest
            .get(`/Dealer/${mockUniversalRetailerId}/status`)
            .auth(TEST_API_KEY, { type: "bearer" })
            .expect(200)
            .expect((res) => {
                expect(res.body).toEqual({
                    Status: "INVALID",
                    Reason: "Retailer is opted out of Web2Text",
                });
            });
    });

    it("should return NONEXISTANT status for a non-existent dealer", async () => {
        const mockUniversalRetailerId = uuidv4();

        mockServer.use(
            http.get(`${process.env.NEXUS_API_URL}/retailers/${mockUniversalRetailerId}`, () => {
                return HttpResponse.json({}, { status: 404 });
            }),
            http.get(`${process.env.NEXUS_AWS_API_URL}/nexus/retailerLocations`, () => {
                return HttpResponse.json({ data: [] }, { status: 200 });
            }),
        );
        await supertest
            .get(`/Dealer/${mockUniversalRetailerId}/status`)
            .auth(TEST_API_KEY, { type: "bearer" })
            .expect(200)
            .expect((res) => {
                expect(res.body).toEqual({
                    Status: "NONEXISTANT",
                    Reason: "Could not find client with this UniversalRetailerId in Nexus",
                });
            });
    });

    it("should handle invalid locations for a valid dealer", async () => {
        const mockUniversalRetailerId = uuidv4();
        mockServer.use(
            http.get(`${process.env.NEXUS_API_URL}/retailers/${mockUniversalRetailerId}`, () => {
                return HttpResponse.json(
                    {
                        id: mockUniversalRetailerId,
                        name: "Test Client",
                        status: "Customer",
                        rlm_api_key: "test_api_key",
                    },
                    { status: 200 },
                );
            }),
            http.get(`${process.env.NEXUS_API_URL}/retailers/${mockUniversalRetailerId}/subscriptions`, () => {
                return HttpResponse.json([{ status: "Live", web2text_opt_out: false }], { status: 200 });
            }),
            http.get(`${process.env.NEXUS_AWS_API_URL}/nexus/retailerLocations`, () => {
                return HttpResponse.json({
                    data: [
                        {
                            birdeye_account_id: "12345",
                            birdeye_business_account_id: "67890",
                            call_tracking_number: "+1234567890",
                            city: "Test City",
                            country: "USA",
                            hours_of_operation: "9:00 AM - 5:00 PM",
                            id: NEXUS_FAKE_LOCATION_ID,
                            latitude: "40.7128",
                            location_id: NEXUS_FAKE_LOCATION_ID,
                            location_name: "Test Store",
                            longitude: "-74.0060",
                            mohawk_store_id: "M12345",
                            retailer_account_name: "Test Retailer",
                            retailer_id: mockUniversalRetailerId,
                            state_province: "CA",
                            store_name: "Test Store",
                            store_phone_number: "+1234567890",
                            Web2Text_Phone_Number: "invalid",
                            store_type: "Retail",
                            street_address: "123 Test St",
                            universal_id: NEXUS_FAKE_LOCATION_ID,
                            zip_code: "12345",
                        },
                    ],
                });
            }),
        );
        await supertest
            .get(`/Dealer/${mockUniversalRetailerId}/status`)
            .auth(TEST_API_KEY, { type: "bearer" })
            .expect(200)
            .expect((res) => {
                expect(res.body).toEqual({
                    Status: "VALID",
                    Locations: [
                        {
                            NexusLocationId: NEXUS_FAKE_LOCATION_ID,
                            UniversalLocationId: NEXUS_FAKE_LOCATION_ID,
                            ZipCode: "12345",
                            Name: "Test Store",
                            StreetAddress: "123 Test St",
                            Status: "INVALID",
                            CallTrackingPhoneNumber: "+1234567890",
                            City: "Test City",
                            State: "CA",
                            StorePhoneNumber: "+1234567890",
                            Reason: "Location's phone number cannot be parsed: 'invalid'",
                        },
                    ],
                });
            });
    });

    it("should return 400 for invalid UniversalRetailerId", async () => {
        await supertest.get("/Dealer/invalid-uuid/status").auth(TEST_API_KEY, { type: "bearer" }).expect(400);
    });
});
