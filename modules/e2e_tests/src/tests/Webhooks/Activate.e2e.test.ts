import { randomUUID } from "node:crypto";
import * as restate from "@restatedev/restate-sdk";
import { WebhookTypeInfo } from "lead-processor-service/restate/services/Webhook/WebhookTypes";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { supertest, TEST_API_KEY } from "../../setup";

describe("Webhook Activate E2E Tests", () => {
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

    beforeEach(() => {
        webhookKey = `test:${randomUUID()}`;
    });

    test("should activate a webhook", async () => {
        const response = await supertest
            .post(`/Webhook/${webhookKey}/activate`)
            .send({})
            .auth(TEST_API_KEY, { type: "bearer" })
            .expect(200);

        expect(response.body).toMatchObject({
            Status: "ACTIVE",
            URL: expect.stringContaining(`/Webhook/${webhookKey}`),
        });
    });

    test("should get webhook status after activation", async () => {
        // First activate the webhook
        await supertest
            .post(`/Webhook/${webhookKey}/activate`)
            .send({})
            .auth(TEST_API_KEY, { type: "bearer" })
            .expect(200);

        // Then check status
        const response = await supertest
            .post(`/Webhook/${webhookKey}/status`)
            .send({})
            .auth(TEST_API_KEY, { type: "bearer" })
            .expect(200);

        expect(response.body).toMatchObject({
            Status: "ACTIVE",
            URL: expect.stringContaining(`/Webhook/${webhookKey}`),
            Subscribers: [],
        });
    });

    test("should reject invalid webhook types", async () => {
        const invalidWebhookKey = `invalid-type:${randomUUID()}`;

        await supertest
            .post(`/Webhook/${invalidWebhookKey}/activate`)
            .send({})
            .auth(TEST_API_KEY, { type: "bearer" })
            .expect(400);
    });

    test("should reject invalid webhook IDs", async () => {
        const invalidWebhookKey = "twilio:invalid@webhook#id";

        await supertest
            .post(`/Webhook/${invalidWebhookKey}/activate`)
            .send({})
            .auth(TEST_API_KEY, { type: "bearer" })
            .expect(400);
    });
});
