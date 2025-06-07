import { randomUUID } from "node:crypto";
import * as restate from "@restatedev/restate-sdk";
import { WebhookTypeInfo } from "lead-processor-service/restate/services/Webhook/WebhookTypes";
import { result } from "src/util";
import { afterAll, beforeAll, beforeEach, describe, test } from "vitest";
import { supertest, TEST_API_KEY } from "../../setup";

describe("Webhook Publish E2E Tests", () => {
    let webhookKey: string;

    beforeAll(async () => {
        Object.assign(WebhookTypeInfo, {
            test: {
                handler: class {
                    async validate({ webhook, event }: { webhook: any; event: any }) {
                        return {
                            Name: "test",
                            Status: "VALID",
                        };
                    }
                    async handle({ webhook, event }: { webhook: any; event: any }) {
                        return {
                            test: "transformed payload",
                        };
                    }
                },
                input: restate.serde.json,
                allowSubscribe: true,
            },
        });
    });

    afterAll(() => {
        // @ts-ignore
        delete WebhookTypeInfo.test;
    });

    beforeEach(async () => {
        webhookKey = `test:${randomUUID()}`;
        // Activate webhook before publishing tests
        await supertest
            .post(`/Webhook/${webhookKey}/activate`)
            .send({})
            .auth(TEST_API_KEY, { type: "bearer" })
            .expect(200);
    });

    test("should reject publishing to inactive webhook", async () => {
        // Deactivate the webhook
        await supertest
            .post(`/Webhook/${webhookKey}/deactivate`)
            .send({})
            .auth(TEST_API_KEY, { type: "bearer" })
            .expect(200);

        const payload = {
            test: "test",
        };

        await supertest
            .post(`/Webhook/${webhookKey}/publish`)
            .send(payload)
            .set("Content-Type", "application/json")
            .auth(TEST_API_KEY, { type: "bearer" })
            .expect(result(409));
    });

    test("should reject publishing to non-existent webhook", async () => {
        const nonExistentKey = `testing:${randomUUID()}`;
        const payload = {
            test: "test",
        };

        await supertest
            .post(`/Webhook/${nonExistentKey}/publish`)
            .set("Content-Type", "application/x-www-form-urlencoded")
            .send(payload)
            .auth(TEST_API_KEY, { type: "bearer" })
            .expect(400);
    });
});
