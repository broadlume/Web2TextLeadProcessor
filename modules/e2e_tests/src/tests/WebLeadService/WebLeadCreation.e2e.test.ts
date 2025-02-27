import { randomUUID } from "node:crypto";
import nock from "nock";
import { TEST_API_KEY } from "src/setup";
import { describe, test } from "vitest";
import { supertest } from "../../setup";

const testLead = {
	UniversalRetailerId: "314aa161-867a-4902-b780-35c62319b418",
	Lead: {
		"E-mail Address": "john@smith.com",
		listId: "123456",
	},
	SyncImmediately: false,
};
const listID = testLead.Lead.listId;

describe("WebLeadCreation", () => {
	test("Successful web lead creation", async () => {
		const leadID = randomUUID();
		nock("http://weblead:80")
			.post(`/${leadID}/create`)
			.reply(200, { Status: "ACTIVE" });

		nock("http://weblead:80")
			.post(`/${leadID}/status`)
			.reply(200, { Status: "ACTIVE" });
		await supertest
			.post(`/WebLead/${leadID}/create`)
			.auth(TEST_API_KEY, { type: "bearer" })
			.send(testLead)
			.expect(200)
			.expect((res) => res.body["Status"] === "ACTIVE");
		await supertest
			.post(`/WebLead/${leadID}/status`)
			.auth(TEST_API_KEY, { type: "bearer" })
			.expect(200)
			.expect((res) => res.body["Status"] === "ACTIVE");
	});

	test("Lead creation with invalid Lead data", async () => {
		const leadID2 = randomUUID();
		nock("http://weblead:80")
			.post(`/${leadID2}/create`)
			.reply(400, { Status: "ACTIVE" });
		await supertest
			.post(`/WebLead/${leadID2}/create`)
			.auth(TEST_API_KEY, { type: "bearer" })
			.send({})
			.expect(400);
	});

	test("Lead sync to FF Web API", async () => {
		const leadID = randomUUID();
		nock(process.env.FF_API_URL!)
			.post("/external/postactonformdata")
			.reply(200, { status: "success" });
		nock(process.env.ACTON_BASE_URL)
			.post("/api/1/list/l-011a/record", {
				"E-mail Address": "john@smith.com",
			})
			.reply(200, { status: "success" });

		nock("http://weblead:80")
			.post(/\/[a-f0-9-]+\/sync/)
			.reply(200, { Status: "ACTIVE" });
		await supertest
			.post(`/WebLead/${leadID}/sync`)
			.auth(TEST_API_KEY, { type: "bearer" })
			.send(testLead)
			.expect(200)
			.expect((res) => res.body["Status"] === "ACTIVE");
	});
});
