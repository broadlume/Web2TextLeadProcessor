import request from "supertest";
import { describe, inject, test } from "vitest";

describe("Restate Server", () => {
    test("Check health", async () => {
        await request(inject("RESTATE_ADMIN_URL")).get("/health").expect(200);
    });
});
