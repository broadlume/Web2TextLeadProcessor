import { randomUUID } from "node:crypto";
import * as restate from "@restatedev/restate-sdk";
import { WebhookEventLogModel } from "lead-processor-service/dynamodb/WebhookEventLogModel";
import { WebhookTypeInfo } from "lead-processor-service/restate/services/Webhook/WebhookTypes";
import { HttpResponse, http } from "msw";
import { mockServer } from "src/mock/server";
import { result } from "src/util";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { supertest, TEST_API_KEY } from "../../setup";

describe("Webhook Service E2E Tests", () => {
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
    describe("Webhook Lifecycle", () => {
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

        test("should get webhook status", async () => {
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

        test("should deactivate a webhook", async () => {
            // First activate the webhook
            await supertest
                .post(`/Webhook/${webhookKey}/activate`)
                .send({})
                .auth(TEST_API_KEY, { type: "bearer" })
                .expect(200);

            // Then deactivate
            const response = await supertest
                .post(`/Webhook/${webhookKey}/deactivate`)
                .send({})
                .auth(TEST_API_KEY, { type: "bearer" })
                .expect(200);

            expect(response.body).toMatchObject({
                Status: "INACTIVE",
                URL: expect.stringContaining(`/Webhook/${webhookKey}`),
            });
        });
    });

    describe("Webhook Subscription Management", () => {
        beforeEach(async () => {
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

    describe("Webhook Publishing", () => {
        beforeEach(async () => {
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

    describe("Webhook Event Broadcasting", () => {
        test("should broadcast events to subscribers", async () => {
            // Activate webhook
            await supertest
                .post(`/Webhook/${webhookKey}/activate`)
                .send({})
                .auth(TEST_API_KEY, { type: "bearer" })
                .expect(200);

            mockServer.use(
                http.post("http://fake-url:12345", () => {
                    return HttpResponse.json(
                        {
                            test: "ok",
                        },
                        {
                            status: 200,
                        },
                    );
                }),
            );
            // Subscribe to webhook (using a mock URL that will fail but we can verify the attempt)
            await supertest
                .post(`/Webhook/${webhookKey}/subscribe`)
                .send({
                    Id: "test-broadcaster",
                    URL: "http://fake-url:12345",
                    Method: "POST",
                })
                .auth(TEST_API_KEY, { type: "bearer" })
                .expect(200)
                .then((response) =>
                    expect(response.body).toMatchObject({
                        SubscriberId: "test-broadcaster",
                        Status: "SUBSCRIBED",
                    }),
                );

            // Publish an event
            const payload = new URLSearchParams({
                MessageSid: "SM" + randomUUID().replace(/-/g, ""),
                AccountSid: "AC" + randomUUID().replace(/-/g, ""),
                From: "+15551234567",
                To: "+15557654321",
                Body: "Test broadcast message",
            });

            const publishResponse = await supertest
                .post(`/Webhook/${webhookKey}/publish`)
                .set("Content-Type", "application/x-www-form-urlencoded")
                .send(payload)
                .auth(TEST_API_KEY, { type: "bearer" })
                .expect(result(200));

            expect(publishResponse.body.EventId).toBeDefined();

            // Wait a bit for async processing
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // Verify event was logged in DynamoDB
            const eventId = publishResponse.body.EventId;
            const event = await WebhookEventLogModel.get(eventId);
            expect(event).toBeDefined();
            expect(event).to.have.property("NotificationStatus").to.have.property("test-broadcaster").to.include({
                Status: "SENT",
                Method: "POST",
                URL: "http://fake-url:12345",
            });
        });
    });

    describe("Webhook Key Validation", () => {
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
});
