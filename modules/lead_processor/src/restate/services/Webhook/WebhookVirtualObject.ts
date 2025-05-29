import * as restate from "@restatedev/restate-sdk";
import { serde as zodSerde } from "@restatedev/restate-sdk-zod";
import { type WebhookType, WebhookTypeInfo } from "./WebhookTypes";
import { assert, is } from "tsafe";
import { ValidationErrorMsg } from "common";
import ky from "ky";
import { v4 as uuidv4 } from "uuid";
import { WebhookEventLogModel } from "#dynamodb/WebhookEventLogModel";
import { z } from "zod";
import type { Scan } from "dynamoose/dist/ItemRetriever";
import { serializeError } from 'serialize-error';

export type WebhookSubscriber = {
    Id: string;
    Method: string;
    URL: string;
}
const EventSchema = z.object({
    EventId: z.string(),
    DateCreated: z.date(),
    Payload: z.any(),
    NotificationStatus: z.record(z.string(), z.object({
        Status: z.enum(["PENDING", "SENT", "FAILED"]),
        URL: z.string().optional(),
        Method: z.string().optional(),
        DateSent: z.date().optional(),
        Response: z.object({
            Status: z.number(),
            Body: z.string().optional(),
            Headers: z.record(z.string(), z.string()),
        }).optional(),
        Error: z.any().optional(),
    })),
})
export type Event = z.infer<typeof EventSchema>;


export interface WebhookState {
    state: "ACTIVE" | "INACTIVE" | "NONEXISTANT";
    subscribers: WebhookSubscriber[];
}

const WebhookIdRegex = /^[a-zA-Z0-9_-]+$/;
const BroadcastSchema = z.object({
    EventId: z.string().describe("The event id to broadcast"),
    Replay: z.boolean().default(false).optional().describe("Whether to replay the event to subscribers that have already received it"),
});

const SubscribeSchema = z.object({
    Id: z.string().regex(/^[a-z0-9_-]+$/).describe("The id to identify the subscriber"),
    URL: z.string().describe("The URL to send the event to"),
    Method: z.string().describe("The method to send the event with"),
});
const UnsubscribeSchema = z.object({
    Id: z.string().regex(/^[a-z0-9_-]+$/).describe("The id to identify the subscriber"),
});
async function setup(ctx: restate.ObjectSharedContext<WebhookState>, req: any): Promise<[WebhookType, string]> {
    const [webhookType, ...rest] = ctx.key.split(":");
    const webhookId = rest.join(":");
    if (!Object.keys(WebhookTypeInfo).includes(webhookType)) {
        throw new restate.TerminalError(`Invalid webhook type: '${webhookType}'`, { "errorCode": 400 });
    }
    if (!WebhookIdRegex.test(webhookId)) {
        throw new restate.TerminalError(`Invalid webhook id: '${webhookId}'`, { "errorCode": 400 });
    }
    const webhookState = await ctx.get("state");
    if (webhookState === "INACTIVE") {
        throw new restate.TerminalError("Webhook is deactivated", { "errorCode": 409 });
    }
    if (webhookState === "NONEXISTANT") {
        throw new restate.TerminalError("Webhook does not exist", { "errorCode": 404 });
    }
    assert(is<WebhookType>(webhookType));
    return [webhookType, webhookId];
}
export const WebhookVirtualObject = restate.object({
    name: "Webhook",
    handlers: {
        publish: restate.handlers.object.shared({ input: restate.serde.binary },
            async (ctx: restate.ObjectSharedContext<WebhookState>, payload: any) => {
                const [webhookType, eventId] = await setup(ctx, payload);
                const webhookTypeInfo = WebhookTypeInfo[webhookType];
                // Deserialize the event payload
                const deserializedPayload = webhookTypeInfo.input.deserialize(payload);
                // Validate the event payload
                const webhookHandler = new webhookTypeInfo.handler(ctx);
                const validationStatus = await webhookHandler.validate({
                    WebhookId: eventId,
                    Payload: deserializedPayload
                });
                if (validationStatus.Status !== "VALID") {
                    throw new restate.TerminalError(ValidationErrorMsg("Event failed validation", validationStatus, true), { "errorCode": 400 });
                }
                // Handle the event payload
                // If the handler returns a value, it will be logged in the event log and sent to the subscribers
                const transformedPayload = await webhookHandler.handle({
                    WebhookId: eventId,
                    Payload: deserializedPayload
                });
                if (transformedPayload == null) {
                    return;
                }
                const subscribers = await ctx.get("subscribers") ?? [];
                const event: Event = {
                    EventId: uuidv4(),
                    DateCreated: new Date(await ctx.date.now()),
                    Payload: transformedPayload,
                    NotificationStatus: Object.fromEntries(subscribers.map((subscriber) => [subscriber.Id, {
                        Status: "PENDING"
                    }]))
                }
                await ctx.run("Create event in database", async () => await WebhookEventLogModel.create(event));
                ctx.objectSendClient(WebhookVirtualObject, "broadcast").broadcast({
                    EventId: event.EventId
                });
                return {
                    Status: "PENDING",
                    EventId: event.EventId,
                    DateCreated: event.DateCreated,
                }
            }
        ),
        broadcast: restate.handlers.object.shared({
            input: zodSerde.zod(BroadcastSchema)
        },
            async (ctx: restate.ObjectSharedContext<WebhookState>, broadcast: z.infer<typeof BroadcastSchema>) => {
                const event = EventSchema.parse(await ctx.run("Get event from DynamoDB", async () => await WebhookEventLogModel.get(broadcast.EventId)));
                let subscribers = await ctx.get("subscribers") ?? [];
                subscribers = subscribers.filter((subscriber) => broadcast.Replay ? event.NotificationStatus[subscriber.Id] != null : event.NotificationStatus[subscriber.Id]?.Status !== "SENT") ;
                if (subscribers.length === 0) {
                    return {
                        EventId: event.EventId,
                        ProcessedCount: 0,
                        NotificationStatus: event.NotificationStatus,
                    }
                }
                const results = await restate.RestatePromise.allSettled(subscribers.map(
                    (subscriber) => ctx.run(`Send event to subscriber ${subscriber.Id}`, async () => {
                        const result = await ky(subscriber.URL, {
                            method: subscriber.Method,
                            json: event.Payload,
                            redirect: "error",
                            timeout: 30_000, // 30 second timeout,
                            retry: 3
                        })
                        return {
                            Status: "SENT",
                            URL: subscriber.URL,
                            Method: subscriber.Method,
                            Response: {
                                Status: result.status,
                                Body: (await result.text().catch(() => undefined))?.substring(0,1024),
                                Headers: Object.fromEntries(result.headers.entries()),
                            }
                        } as Event["NotificationStatus"][string]
                    })
                ));
                for (const [index,subscriber] of subscribers.entries()) {
                    const result = results[index];
                    if (result.status === "fulfilled") {
                        const response = result.value;
                        event.NotificationStatus[subscriber.Id] = {
                            ...response,
                            DateSent: new Date(await ctx.date.now()),
                        }
                    }
                    else {
                        event.NotificationStatus[subscriber.Id] = {
                            Status: "FAILED",
                            Error: result.reason instanceof Error ? serializeError(result.reason) : result.reason,
                        }
                    }
                }
                await ctx.run("Update event in DynamoDB", async () => await WebhookEventLogModel.update(event));
                return {
                    EventId: event.EventId,
                    ProcessedCount: subscribers.length,
                    NotificationStatus: event.NotificationStatus,
                }
            }
        ),
        subscribe: restate.handlers.object.exclusive({
            input: zodSerde.zod(SubscribeSchema)
        }, async (ctx: restate.ObjectContext<WebhookState>, req: z.infer<typeof SubscribeSchema>) => {
            const [webhookType, webhookId] = await setup(ctx, req);
            const subscribers = await ctx.get("subscribers") ?? [];
            if (subscribers.some((subscriber) => subscriber.Id === req.Id)) {
                throw new restate.TerminalError("Subscriber already exists", { "errorCode": 400 });
            }
            subscribers.push(req);
            ctx.set("subscribers", subscribers);
            return {
                URL: `${process.env.PUBLIC_RESTATE_INGRESS_URL}/Webhook/${ctx.key}`,
                SubscriberId: req.Id,
                Status: "SUBSCRIBED",
            }
        }),
        unsubscribe: restate.handlers.object.exclusive({
            input: zodSerde.zod(UnsubscribeSchema)
        }, async (ctx: restate.ObjectContext<WebhookState>, req: z.infer<typeof UnsubscribeSchema>) => {
            const [webhookType, webhookId] = await setup(ctx, req);
            let subscribers = await ctx.get("subscribers") ?? [];
            const subscriber = subscribers.find((subscriber) => subscriber.Id === req.Id);
            if (subscriber == null) {
                throw new restate.TerminalError("Subscriber not found", { "errorCode": 409 });
            }
            subscribers = subscribers.filter((s) => s.Id !== subscriber.Id);
            ctx.set("subscribers", subscribers);
            return {
                URL: `${process.env.PUBLIC_RESTATE_INGRESS_URL}/Webhook/${ctx.key}`,
                SubscriberId: req.Id,
                Status: "UNSUBSCRIBED",
            }
        }),
        activate: restate.handlers.object.exclusive({
            input: zodSerde.zod(z.object({}))
        }, async (ctx: restate.ObjectContext<WebhookState>) => {
            ctx.set("state", "ACTIVE");
            return {
                URL: `${process.env.PUBLIC_RESTATE_INGRESS_URL}/Webhook/${ctx.key}`,
                Status: "ACTIVE",
            }
        }),
        deactivate: restate.handlers.object.exclusive({
            input: zodSerde.zod(z.object({}))
        }, async (ctx: restate.ObjectContext<WebhookState>) => {
            ctx.set("state", "INACTIVE");
            return {
                URL: `${process.env.PUBLIC_RESTATE_INGRESS_URL}/Webhook/${ctx.key}`,
                Status: "INACTIVE",
            }
        }),
        status: restate.handlers.object.shared({
            input: zodSerde.zod(z.object({}))
        }, async (ctx: restate.ObjectSharedContext<WebhookState>) => {
            return {
                URL: `${process.env.PUBLIC_RESTATE_INGRESS_URL}/Webhook/${ctx.key}`,
                Status: ctx.get("state") ?? "NONEXISTANT",
                Subscribers: ctx.get("subscribers") ?? [],
            }
        }),
}
})