import { describe, test } from "vitest";
import { supertest } from "../setup";
import { randomUUID } from "node:crypto";
import nock from "nock";
import { SERVICE_NAME, TEST_API_KEY } from "../setup";

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
			});
		nock(process.env.NEXUS_AWS_API_URL!)
			.get("/nexus/location")
			.query({ location_id: testLead.LocationId })
			.reply(200, {
				data: [
					{
						id: testLead.LocationId,
						location_id: testLead.LocationId,
					},
				],
			});
		const leadID = randomUUID();
		await supertest
			.post(`/${SERVICE_NAME}/${leadID}/create`)
			.auth(TEST_API_KEY, { type: "bearer" })
			.send(testLead)
			.expect(200)
			.expect((resp) => resp.body["Status"] === "ACTIVE");
		await supertest
			.get(`/${SERVICE_NAME}/${leadID}/status`)
			.auth(TEST_API_KEY, { type: "bearer" })
			.expect(200)
			.expect((resp) => resp.body["Status"] === "ACTIVE");
	});

	test("Lead creation with invalid UniversalRetailerId", async () => {
		const newRetailerId = randomUUID();
		nock(process.env.NEXUS_API_URL!)
			.get(`/retailers/${newRetailerId}`)
			.reply(404);
		const leadID = randomUUID();
		await supertest
			.post(`/${SERVICE_NAME}/${leadID}/create`)
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
			});
		nock(process.env.NEXUS_AWS_API_URL!)
			.get("/nexus/location")
			.query({ location_id: testLead.LocationId })
			.reply(404)
			.persist();
		const leadID = randomUUID();
		await supertest
			.post(`/${SERVICE_NAME}/${leadID}/create`)
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
			.post(`/${SERVICE_NAME}/${leadID}/create`)
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
			.post(`/${SERVICE_NAME}/${leadID}/create`)
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
			.persist();
		nock(process.env.NEXUS_AWS_API_URL!)
			.get("/nexus/location")
			.query({ location_id: testLead.LocationId })
			.reply(200, {
				data: [
					{
						id: testLead.LocationId,
						location_id: testLead.LocationId,
					},
				],
			})
			.persist();
		nock(process.env.RLM_API_URL!)
			.post(`/api/${rlm_api_key}/leads`)
			.reply(200, {
				result: "Success",
				lead_id: randomUUID(),
			})
			.persist();
		const leadID = randomUUID();
		await supertest
			.post(`/${SERVICE_NAME}/${leadID}/create`)
			.auth(TEST_API_KEY, { type: "bearer" })
			.send(testLead)
			.expect(200);
		await supertest
			.post(`/${SERVICE_NAME}/${leadID}/create`)
			.auth(TEST_API_KEY, { type: "bearer" })
			.send(testLead)
			.expect(409);
	});
});
