import { randomUUID } from "node:crypto";
import * as restate from "@restatedev/restate-sdk";
import { WebhookTypeInfo } from "lead-processor-service/restate/services/Webhook/WebhookTypes";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { supertest, TEST_API_KEY } from "../../setup";

describe("Webhook Deactivate E2E Tests", () => {
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
