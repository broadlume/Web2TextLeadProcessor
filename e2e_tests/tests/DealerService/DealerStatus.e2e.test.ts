import { describe, it, expect } from "vitest";
import { supertest, TEST_API_KEY } from "../../setup";
import nock from "nock";
import { v4 as uuidv4 } from "uuid";
import { DEALER_SERVICE_NAME } from "../../globalSetup";
import { findNumbers } from "libphonenumber-js";

describe("DealerStatus E2E Tests", () => {
	const mockUniversalRetailerId = uuidv4();
	const mockLocationId = uuidv4();
	it("should return VALID status for a valid dealer with valid locations", async () => {
		// Mock Nexus API responses
		nock(process.env.NEXUS_API_URL!)
			.get(`/retailers/${mockUniversalRetailerId}`)
			.reply(200, { status: "Active" })
			.get(`/retailers/${mockUniversalRetailerId}/subscriptions`)
			.reply(200, [{ status: "Active", web2text_opt_out: false }])
			.get(`/retailers/${mockUniversalRetailerId}/stores`)
			.reply(200, [
				{
					id: mockLocationId,
					store_name: "Test Store",
					street_address: "123 Test St",
					Web2Text_Phone_Number: "+12345678900",
				},
			])
			.persist();

		nock(process.env.NEXUS_AWS_API_URL!)
			.get("/nexus/location")
			.query({ location_id: mockLocationId })
			.reply(200, {
				data: [
					{
						id: mockLocationId,
						store_name: "Test Store",
						street_address: "123 Test St",
						Web2Text_Phone_Number: "+12345678900",
					},
				],
			})
			.persist();
		nock(process.env.NEXUS_AWS_API_URL!)
			.get("/nexus/retailerLocations")
			.query({ retailer_id: mockUniversalRetailerId })
			.reply(200, {
				data: [
					{
						id: mockLocationId,
						store_name: "Test Store",
						street_address: "123 Test St",
						Web2Text_Phone_Number: "+12345678900",
					},
				],
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

		await supertest
			.get(`/${DEALER_SERVICE_NAME}/${mockUniversalRetailerId}/status`)
			.auth(TEST_API_KEY, { type: "bearer" })
			.expect(200)
			.expect((res) => {
				expect(res.body).toEqual({
					Status: "VALID",
					Locations: [
						{
							NexusLocationId: mockLocationId,
							Name: "Test Store",
							Address: "123 Test St",
							PhoneNumber: "+12345678900",
							Status: "VALID",
						},
					],
				});
			});
	});

	it("should return INVALID status for a churned dealer", async () => {
		nock(process.env.NEXUS_API_URL!)
			.get(`/retailers/${mockUniversalRetailerId}`)
			.reply(200, { status: "Churned_Customer" });

		await supertest
			.get(`/${DEALER_SERVICE_NAME}/${mockUniversalRetailerId}/status`)
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
		nock(process.env.NEXUS_API_URL!)
			.get(`/retailers/${mockUniversalRetailerId}`)
			.reply(200, { status: "Active" })
			.get(`/retailers/${mockUniversalRetailerId}/subscriptions`)
			.reply(200, [{ status: "Active", web2text_opt_out: true }]);

		await supertest
			.get(`/${DEALER_SERVICE_NAME}/${mockUniversalRetailerId}/status`)
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
		nock(process.env.NEXUS_API_URL!)
			.get(`/retailers/${mockUniversalRetailerId}`)
			.reply(404);

		await supertest
			.get(`/${DEALER_SERVICE_NAME}/${mockUniversalRetailerId}/status`)
			.auth(TEST_API_KEY, { type: "bearer" })
			.expect(200)
			.expect((res) => {
				expect(res.body).toEqual({
					Status: "NONEXISTANT",
					Reason:
						"Could not find client with this UniversalRetailerId in Nexus",
				});
			});
	});

	it("should handle invalid locations for a valid dealer", async () => {
		nock(process.env.NEXUS_API_URL!)
			.get(`/retailers/${mockUniversalRetailerId}`)
			.reply(200, { status: "Active" })
			.get(`/retailers/${mockUniversalRetailerId}/subscriptions`)
			.reply(200, [{ status: "Active", web2text_opt_out: false }])
			.get(`/retailers/${mockUniversalRetailerId}/stores`)
			.reply(200, [
				{
					id: mockLocationId,
					store_name: "Test Store",
					street_address: "123 Test St",
					Web2Text_Phone_Number: "invalid",
				},
			]);
		nock(process.env.NEXUS_AWS_API_URL!)
			.get("/nexus/retailerLocations")
			.query({ retailer_id: mockUniversalRetailerId })
			.reply(200, {
				data: [
					{
						id: mockLocationId,
						store_name: "Test Store",
						street_address: "123 Test St",
						Web2Text_Phone_Number: "invalid",
					},
				],
			})
			.persist();

		nock(process.env.NEXUS_AWS_API_URL!)
			.get("/nexus/location")
			.query({ location_id: mockLocationId })
			.reply(200, {
				data: [{ id: mockLocationId, Web2Text_Phone_Number: "invalid" }],
			});

		await supertest
			.get(`/${DEALER_SERVICE_NAME}/${mockUniversalRetailerId}/status`)
			.auth(TEST_API_KEY, { type: "bearer" })
			.expect(200)
			.expect((res) => {
				expect(res.body).toEqual({
					Status: "VALID",
					Locations: [
						{
							NexusLocationId: mockLocationId,
							Name: "Test Store",
							Address: "123 Test St",
							Status: "INVALID",
							Reason:
								"Location does not have a phone number associated in Nexus or phone number cannot be parsed",
						},
					],
				});
			});
	});

	it("should return 400 for invalid UniversalRetailerId", async () => {
		await supertest
			.get(`/${DEALER_SERVICE_NAME}/invalid-uuid/status`)
			.auth(TEST_API_KEY, { type: "bearer" })
			.expect(400);
	});
});