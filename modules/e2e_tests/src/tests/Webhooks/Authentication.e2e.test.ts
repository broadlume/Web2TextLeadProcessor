import { supertest } from "src/setup";
import { describe, test } from "vitest";

describe("Webhook Authentication", () => {
    test("should require authentication for all webhook operations", async () => {
        const operations = [
            { path: "activate", payload: {} },
            { path: "deactivate", payload: {} },
            { path: "status", payload: {} },
            { path: "subscribe", payload: { Id: "test", URL: "https://example.com", Method: "POST" } },
            { path: "unsubscribe", payload: { Id: "test" } },
        ];

        for (const operation of operations) {
            await supertest.post(`/Webhook/test/${operation.path}`).send(operation.payload).expect(401);
        }
    });

    test("should reject invalid API keys", async () => {
        await supertest.post("/Webhook/test/activate").send({}).auth("invalid-api-key", { type: "bearer" }).expect(401);
    });
});
