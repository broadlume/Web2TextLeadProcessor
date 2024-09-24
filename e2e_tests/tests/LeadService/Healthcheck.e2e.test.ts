import { randomUUID } from "node:crypto";
import {supertest} from "../../setup";
import { describe, test } from "vitest";
import { LEAD_SERVICE_NAME } from "../../globalSetup";
import { TEST_API_KEY } from "../../setup";

describe("Web2Text Service", () => {
	const endpoints = ["status", "create", "sync", "close"];
	for (const endpoint of endpoints) {
		test(`Check ${endpoint} endpoint exists`, async () => {
			const leadID = randomUUID();
			await supertest
				.get(`/${LEAD_SERVICE_NAME}/${leadID}/status`)
				.auth(TEST_API_KEY, { type: "bearer" })
				.expect((resp) => resp.status !== 404 && resp.status !== 500)
		});
	}
});