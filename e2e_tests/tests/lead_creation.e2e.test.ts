import { describe, expect, inject, test } from "vitest";
import { supertest } from "../setup";
import { randomUUID } from "node:crypto";
import nock from "nock";
import { SERVICE_NAME, TEST_API_KEY } from "../setup";
const testLead = {
	UniversalRetailerId: "4f99ebbd-e9e5-4d64-9507-cded95ae1044",
	LocationId: "4f99ebbd-e9e5-4d64-9507-cded95ae1044",
	Lead: {
		PageUrl: "https://carpetdirect.com/d/some-product/some-sku",
		IPAddress: "127.0.0.1",
		Name: "John Smith",
		PhoneNumber: "+18777804236",
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
	test("Lead creation", async () => {
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
			.reply(200, {
				data: [
					{
						id: "4f99ebbd-e9e5-4d64-9507-cded95ae1044",
						location_id: "4f99ebbd-e9e5-4d64-9507-cded95ae1044",
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
});
