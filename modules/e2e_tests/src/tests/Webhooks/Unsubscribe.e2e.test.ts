import { randomUUID } from "node:crypto";
import * as restate from "@restatedev/restate-sdk";
import { WebhookTypeInfo } from "lead-processor-service/restate/services/Webhook/WebhookTypes";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { supertest, TEST_API_KEY } from "../../setup";

describe("Webhook Unsubscribe E2E Tests", () => {
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
        // Activate webhook before unsubscription tests
        await supertest
            .post(`/Webhook/${webhookKey}/activate`)
            .send({})
            .auth(TEST_API_KEY, { type: "bearer" })
            .expect(200);
    });

    test("should unsubscribe from a webhook", async () => {
        const subscriberId = "test-subscriber-unsubscribe";
        const subscriptionPayload = {
            Id: subscriberId,
            URL: "https://example.com/webhook",
            Method: "POST",
        };

        // First subscribe
        await supertest
            .post(`/Webhook/${webhookKey}/subscribe`)
            .send(subscriptionPayload)
            .auth(TEST_API_KEY, { type: "bearer" })
            .expect(200);

        // Then unsubscribe
        const response = await supertest
            .post(`/Webhook/${webhookKey}/unsubscribe`)
            .send({ Id: subscriberId })
            .auth(TEST_API_KEY, { type: "bearer" })
            .expect(200);

        expect(response.body).toMatchObject({
            URL: expect.stringContaining(`/Webhook/${webhookKey}`),
            SubscriberId: subscriberId,
            Status: "UNSUBSCRIBED",
        });
    });

    test("should not allow unsubscribing non-existent subscriber", async () => {
        await supertest
            .post(`/Webhook/${webhookKey}/unsubscribe`)
            .send({ Id: "non-existent-subscriber" })
            .auth(TEST_API_KEY, { type: "bearer" })
            .expect(409);
    });
});
