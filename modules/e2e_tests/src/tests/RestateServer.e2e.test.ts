import { describe, test } from "bun:test";
import request from "supertest";
describe("Restate Server", () => {
	test("Check health", async () => {
		await request(process.env.RESTATE_ADMIN_URL!).get("/health").expect(200);
	});
});
