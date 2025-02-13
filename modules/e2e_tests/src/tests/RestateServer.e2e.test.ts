import request from "supertest";
import { describe, test } from "vitest";
describe("Restate Server", () => {
	test("Check health", async () => {
		await request(process.env.RESTATE_ADMIN_URL!).get("/health").expect(200);
	});
});
