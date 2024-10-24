import { findNumbers } from "libphonenumber-js";
import nock from "nock";
import { v4 as uuidv4 } from "uuid";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LEAD_SERVICE_NAME } from "../../globalSetup";
import { TEST_API_KEY, supertest } from "../../setup";
const leadId = uuidv4();
const testLead = {
	UniversalRetailerId: uuidv4(),
	LocationId: uuidv4(),
	Lead: {
		PageUrl: "https://example.com",
		IPAddress: "192.168.1.1",
		Name: "John Doe",
		PhoneNumber: "+12345678900",
		PreferredMethodOfContact: "text",
		CustomerMessage: "I'm interested in your products",
	},
	SyncImmediately: false,
};

describe("Lead Close E2E Tests", () => {
	beforeEach(() => {
		const rlm_api_key = uuidv4();
		nock(process.env.NEXUS_API_URL!)
			.get(`/retailers/${testLead.UniversalRetailerId}`)
			.reply(200, {
				id: testLead.UniversalRetailerId,
				name: "Test Client",
				status: "Customer",
				rlm_api_key: rlm_api_key,
			})
			.persist()
			.get(`/retailers/${testLead.UniversalRetailerId}/subscriptions`)
			.reply(200, [
				{
					status: "Live",
					web2text_opt_out: false,
					subscription_status: "Live",
				},
			])
			.persist();

		nock(process.env.NEXUS_AWS_API_URL!)
			.get("/nexus/location")
			.query({ location_id: testLead.LocationId })
			.reply(200, {
				data: [
					{
						id: testLead.LocationId,
						location_id: testLead.LocationId,
						Web2Text_Phone_Number: "+12246591932",
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
		// Create a lead first
		const createResponse = await supertest
			.post(`/${LEAD_SERVICE_NAME}/${leadId}/create`)
			.auth(TEST_API_KEY, { type: "bearer" })
			.send(testLead)
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
		// Create a lead first
		await supertest
			.post(`/${LEAD_SERVICE_NAME}/${leadId}/create`)
			.auth(TEST_API_KEY, { type: "bearer" })
			.send(testLead)
			.expect(200);

		// Sync the lead
		await supertest
			.post(`/${LEAD_SERVICE_NAME}/${leadId}/sync`)
			.auth(TEST_API_KEY, { type: "bearer" })
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
		expect(closeResponse.body).to.have.property("Integrations");
		expect(Object.keys(closeResponse.body.Integrations).length === 1);
		for (const [integration, state] of Object.entries(
			closeResponse.body.Integrations,
		)) {
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			expect((state as any).SyncStatus === "CLOSED");
		}
	});

	it("should return 409 when trying to close a non-existent lead", async () => {
		const nonExistentLeadId = uuidv4();
		await supertest
			.post(`/${LEAD_SERVICE_NAME}/${nonExistentLeadId}/close`)
			.auth(TEST_API_KEY, { type: "bearer" })
			.send({ reason: "Test close reason" })
			.expect(409);
	});

	it("should return the same response trying to close an already closed lead", async () => {
		// Create and close a lead
		const createResponse = await supertest
			.post(`/${LEAD_SERVICE_NAME}/${leadId}/create`)
			.auth(TEST_API_KEY, { type: "bearer" })
			.send(testLead)
			.expect(200);

		const response1 = await supertest
			.post(`/${LEAD_SERVICE_NAME}/${leadId}/close`)
			.auth(TEST_API_KEY, { type: "bearer" })
			.send({ reason: "First close" })
			.expect(200);

		// Try to close it again
		const response2 = await supertest
			.post(`/${LEAD_SERVICE_NAME}/${leadId}/close`)
			.auth(TEST_API_KEY, { type: "bearer" })
			.send({ reason: "Second close attempt" })
			.expect(200);

		expect(response2.body).to.deep.equal(
			response1.body,
			"Close responses aren't the same",
		);
	});
});
