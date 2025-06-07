import { randomUUID } from "node:crypto";
import * as restate from "@restatedev/restate-sdk";
import { WebhookEventLogModel } from "lead-processor-service/dynamodb/WebhookEventLogModel";
import { WebhookTypeInfo } from "lead-processor-service/restate/services/Webhook/WebhookTypes";
import { HttpResponse, http } from "msw";
import { mockServer } from "src/mock/server";
import { result } from "src/util";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { supertest, TEST_API_KEY } from "../../setup";

describe("Webhook Broadcast E2E Tests", () => {
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
