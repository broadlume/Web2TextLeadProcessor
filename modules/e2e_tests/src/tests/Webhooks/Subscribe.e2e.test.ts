import { randomUUID } from "node:crypto";
import * as restate from "@restatedev/restate-sdk";
import { WebhookTypeInfo } from "lead-processor-service/restate/services/Webhook/WebhookTypes";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { supertest, TEST_API_KEY } from "../../setup";

describe("Webhook Subscribe E2E Tests", () => {
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
        // Activate webhook before subscription tests
        await supertest
            .post(`/Webhook/${webhookKey}/activate`)
            .send({})
            .auth(TEST_API_KEY, { type: "bearer" })
            .expect(200);
    });

    test("should subscribe to a webhook", async () => {
        const subscriberId = "test-subscriber-1";
        const subscriptionPayload = {
            Id: subscriberId,
            URL: "https://example.com/webhook",
            Method: "POST",
        };

        const response = await supertest
            .post(`/Webhook/${webhookKey}/subscribe`)
            .send(subscriptionPayload)
            .auth(TEST_API_KEY, { type: "bearer" })
            .expect(200);

        expect(response.body).toMatchObject({
            URL: expect.stringContaining(`/Webhook/${webhookKey}`),
            SubscriberId: subscriberId,
            Status: "SUBSCRIBED",
        });
    });

    test("should not allow duplicate subscribers", async () => {
        const subscriberId = "test-subscriber-duplicate";
        const subscriptionPayload = {
            Id: subscriberId,
            URL: "https://example.com/webhook",
            Method: "POST",
        };

        // First subscription should succeed
        await supertest
            .post(`/Webhook/${webhookKey}/subscribe`)
            .send(subscriptionPayload)
            .auth(TEST_API_KEY, { type: "bearer" })
            .expect(200);

        // Second subscription with same ID should fail
        await supertest
            .post(`/Webhook/${webhookKey}/subscribe`)
            .send(subscriptionPayload)
            .auth(TEST_API_KEY, { type: "bearer" })
            .expect(400);
    });
});
