import { describe, expect, test } from "bun:test";
import { SERVICE_NAME, supertest, TEST_API_KEY } from "../setup";
import { randomUUID } from "node:crypto";

const testLead = {
	Lead: {
		UniversalClientId: "e2653bf4-593e-490c-acbf-d41a2eca6a43",
		Date: "2024-06-24T00:00:00Z",
		PageUrl: "https://carpetdirect.com/d/some-product/some-sku",
		IPAddress: "127.0.0.1",
		LeadInformation: {
			Name: "John Smith",
			PhoneNumber: "+18777804236",
			LocationID: "4f99ebbd-e9e5-4d64-9507-cded95ae1044",
			PreferredMethodOfContact: "text",
			CustomerMessage: "Hi there, I would like to buy your flooring!",
			AssociatedProductInfo: {
				Brand: "Mohawk",
				Product: "ExampleProduct",
				Variant: "ExampleVariant",
			},
		},
	},
};

describe("Lead Creation", () => {
	test("Lead creation", async () => {
		const leadID = randomUUID();
		await supertest
			.post(`/${SERVICE_NAME}/${leadID}/create`)
			.auth(TEST_API_KEY, { type: "bearer" })
			.send(testLead)
			.expect(200)
			.expect((resp) => resp.body["Status"] === "ACTIVE");
		await supertest
			.post(`/${SERVICE_NAME}/${leadID}/status`)
			.auth(TEST_API_KEY, { type: "bearer" })
			.send(testLead)
			.expect(200)
			.expect((resp) => resp.body["Status"] === "ACTIVE");
	});
});
