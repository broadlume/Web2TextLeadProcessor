import { randomUUID } from "node:crypto";
import { findNumbers } from "libphonenumber-js";
import nock from "nock";
import { describe, test } from "vitest";
import { LEAD_SERVICE_NAME } from "../../globalSetup";
import { supertest } from "../../setup";
import { TEST_API_KEY } from "../../setup";

const testLead = {
	UniversalRetailerId: "314aa161-867a-4902-b780-35c62319b418",
	LocationId: "d3ff7b23-fe09-4959-85b7-fb08d4bb1cb9",
	Lead: {
		PageUrl: "https://carpetdirect.com/d/some-product/some-sku",
		IPAddress: "127.0.0.1",
		Name: "John Smith",
		PhoneNumber: "+11234567891",
		PreferredMethodOfContact: "text",
		CustomerMessage: "Hi there, I would like to buy your flooring!",
		AssociatedProductInfo: {
			Brand: "Mohawk",
			Product: "ExampleProduct",
			Variant: "ExampleVariant",
		},
	},
	SyncImmediately: false,
};
describe("Lead Creation", () => {
	test("Successful lead creation", async () => {
		const rlm_api_key = randomUUID();
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
		const leadID = randomUUID();
		await supertest
			.post(`/${LEAD_SERVICE_NAME}/${leadID}/create`)
			.auth(TEST_API_KEY, { type: "bearer" })
			.send(testLead)
			.expect(200)
			.expect((resp) => resp.body["Status"] === "ACTIVE");
		await supertest
			.get(`/${LEAD_SERVICE_NAME}/${leadID}/status`)
			.auth(TEST_API_KEY, { type: "bearer" })
			.expect(200)
			.expect((resp) => resp.body["Status"] === "ACTIVE");
	});

	test("Lead creation with invalid UniversalRetailerId", async () => {
		const newRetailerId = randomUUID();
		nock(process.env.NEXUS_API_URL!)
			.get(`/retailers/${newRetailerId}`)
			.reply(404)
			.persist();
		const leadID = randomUUID();
		await supertest
			.post(`/${LEAD_SERVICE_NAME}/${leadID}/create`)
			.auth(TEST_API_KEY, { type: "bearer" })
			.send({ ...testLead, UniversalRetailerId: newRetailerId })
			.expect(400);
	});

	test("Lead creation with invalid LocationId", async () => {
		nock(process.env.NEXUS_API_URL!)
			.get(`/retailers/${testLead.UniversalRetailerId}`)
			.reply(200, {
				id: testLead.UniversalRetailerId,
				name: "Test Client",
				status: "Customer",
				rlm_api_key: randomUUID(),
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
			.reply(404)
			.persist();
		const leadID = randomUUID();
		await supertest
			.post(`/${LEAD_SERVICE_NAME}/${leadID}/create`)
			.auth(TEST_API_KEY, { type: "bearer" })
			.send(testLead)
			.expect(400);
	});

	test("Lead creation with invalid phone number", async () => {
		const invalidLead = {
			...testLead,
			Lead: { ...testLead.Lead, PhoneNumber: "invalid-phone" },
		};
		const leadID = randomUUID();
		await supertest
			.post(`/${LEAD_SERVICE_NAME}/${leadID}/create`)
			.auth(TEST_API_KEY, { type: "bearer" })
			.send(invalidLead)
			.expect(400);
	});

	test("Lead creation with missing required fields", async () => {
		const incompleteLead = {
			UniversalRetailerId: testLead.UniversalRetailerId,
			LocationId: testLead.LocationId,
			Lead: {
				PageUrl: testLead.Lead.PageUrl,
				IPAddress: testLead.Lead.IPAddress,
			},
		};
		const leadID = randomUUID();
		await supertest
			.post(`/${LEAD_SERVICE_NAME}/${leadID}/create`)
			.auth(TEST_API_KEY, { type: "bearer" })
			.send(incompleteLead)
			.expect(400);
	});

	test("Duplicate lead creation", async () => {
		const rlm_api_key = randomUUID();
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
		const leadID = randomUUID();
		await supertest
			.post(`/${LEAD_SERVICE_NAME}/${leadID}/create`)
			.auth(TEST_API_KEY, { type: "bearer" })
			.send(testLead)
			.expect(200);
		await supertest
			.post(`/${LEAD_SERVICE_NAME}/${leadID}/create`)
			.auth(TEST_API_KEY, { type: "bearer" })
			.send(testLead)
			.expect(409);
	});
});
