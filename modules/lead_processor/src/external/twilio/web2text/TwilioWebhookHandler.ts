import { OptedOutNumberModel } from "#dynamodb";
import { LeadVirtualObject } from "#restate";
import { type WebhookCall, WebhookHandler } from "#restate/services/Webhook/WebhookHandler";
import { WebhookVirtualObject } from "#restate/services/Webhook/WebhookVirtualObject";
import * as restate from "@restatedev/restate-sdk";
import type { ValidationStatus } from "common";
import { TwilioConversationHelpers } from "common/external/twilio";
import type { E164Number } from "libphonenumber-js";
import { assert, is } from "tsafe";
import MessagingResponse from "twilio/lib/twiml/MessagingResponse";
import { validateRequest } from "twilio/lib/webhooks/webhooks";
import { z } from "zod";
import { DealerCloseMessage, CustomerCloseMessage } from "./Web2TextMessagingStrings";

interface TwilioWebhookBody {
	AccountSid: string;
	EventType: string;
	Source: string;
	ClientIdentity: string;
}

type TwilioConversationMessageWebhookBody = TwilioWebhookBody & {
	Author: string;
	Body: string;
	MessageSid: string;
	ConversationSid: string;
};
type TwilioConversationStateUpdatedWebhookBody = TwilioWebhookBody & {
	StateFrom: "active" | "inactive" | "closed";
	StateTo: "active" | "inactive" | "closed";
	Reason: string;
	ConversationSid: string;
};
export interface TwilioMessagingServiceBody {
	MessageSid: string;
	From: E164Number;
	To: E164Number;
	Body: string;
	OptOutType?: "START" | "STOP" | "HELP";
}

export class TwilioWebhookHandler extends WebhookHandler<Record<string, any>, any> {
    WebhookType = "twilio";
    restateContext: restate.ObjectSharedContext<any>;
    constructor(restateContext: restate.ObjectSharedContext<any>) {
        super();
        this.restateContext = restateContext;
    }
    private async ValidateWebhookSignature(
        webhookId: string,
        payload: object,
    ): Promise<ValidationStatus> {
        const twilioHeader =
        this.restateContext.request().headers.get("x-twilio-signature") ??
        this.restateContext.request().headers.get("X-Twilio-Signature");
        if (twilioHeader == null) {
            return {
                Name: "Twilio Webhook Signature",
                Status: "NONEXISTANT",
                Reason: "Twilio webhook signature missing from request",
            };
        }
        const thisUrl = new URL(
            `${WebhookVirtualObject.name}/${this.WebhookType}:${webhookId}/publish`,
            process.env.PUBLIC_RESTATE_INGRESS_URL,
        );
        thisUrl.port = "";
        if (
            !validateRequest(
                process.env.TWILIO_AUTH_TOKEN,
                twilioHeader,
                thisUrl.toString(),
                payload,
            )
        ) {
            return {
                Name: "Twilio Webhook Signature",
                Value: {
                    twilioHeader,
                    thisUrl: thisUrl.toString(),
                    payload,
                },
                Status: "INVALID",
                Reason: "Twilio request validation did not match expected signature",
            }
        }
        return {
            Name: "Twilio Webhook Signature",
            Status: "VALID",
        };
    }
    async validate(call: WebhookCall<Record<string, any>>): Promise<ValidationStatus> {
        const [webhookOperation, ...rest] = call.WebhookId.split(":");
        const leadId = rest.join(":");
        switch (webhookOperation) {
            case "onIncomingMessage":
                if (leadId != null) {
                    return {
                        Name: "Twilio Webhook Operation",
                        Value: leadId,
                        Status: "INVALID",
                        Reason: "Lead ID is not allowed in 'incomingMessage' webhook",
                    }
                }
                break;
            case "sync":
            case "close":
                if (leadId == null) {
                    return {
                        Name: "Twilio Webhook Operation",
                        Status: "INVALID",
                        Reason: "Lead ID is required in 'sync' and 'close' webhooks",
                    }
                }
                if (z.string().uuid().safeParse(leadId).success === false) {
                    return {
                        Name: "Twilio Webhook Lead ID",
                        Value: leadId,
                        Status: "INVALID",
                        Reason: "Lead ID is not a valid UUIDv4",
                    }
                }
                break;
            default:
                return {
                    Name: "Twilio Webhook Operation",
                    Status: "INVALID",
                    Reason: `Invalid webhook operation: '${webhookOperation}'`,
                }
        }
        const twilioSignatureValidation = await this.ValidateWebhookSignature(call.WebhookId, call.Payload);
        if (twilioSignatureValidation.Status !== "VALID") {
            return twilioSignatureValidation;
        }
        return {
            Name: "Twilio Webhook Request",
            Status: "VALID",
        };
    }
    async handle(call: WebhookCall<Record<string, any>>): Promise<any> {
        const [webhookOperation, ...rest] = call.WebhookId.split(":");
        const payload = call.Payload;
        const leadId = rest.join(":");
        switch (webhookOperation) {
            case "onIncomingMessage":
                assert(is<TwilioMessagingServiceBody>(payload));
                return this.onIncomingMessage(leadId, payload);
            case "sync":
                assert(is<TwilioConversationMessageWebhookBody>(payload));
                return this.onSync(leadId, payload);
            case "close":
                assert(is<TwilioConversationStateUpdatedWebhookBody>(payload));
                return this.onClose(leadId, payload);
            default:
                throw new Error(`Invalid webhook operation: '${webhookOperation}'`);
        }
    }
    private async onSync(leadId: string, payload: TwilioConversationMessageWebhookBody): Promise<any> {
        const conversation = await this.restateContext.run(
            "Fetch Twilio conversation",
            async () =>
                await TWILIO_CLIENT.conversations.v1
                    .conversations(payload.ConversationSid)
                    .fetch(),
        );
        const attributes = JSON.parse(conversation.attributes ?? "{}");
        const leadIds = attributes["LeadIds"] ?? [];
        this.restateContext.console.log(`Executing 'sync' for ${leadIds.length} lead(s)`, {
            _meta: 1,
            TwilioConversationSID: conversation.sid,
            LeadIds: leadIds,
        });
        for (const leadId of leadIds) {
            this.restateContext
                .objectSendClient(LeadVirtualObject, leadId)
                .sync({}, restate.rpc.sendOpts({
                    headers: {
                        "authorization": process.env.INTERNAL_API_TOKEN!
                    }
                }));
        }
    }
    private async onClose(leadId: string, payload: TwilioConversationStateUpdatedWebhookBody): Promise<any> {
        const conversation = await this.restateContext.run(
            "Fetch Twilio conversation",
            async () =>
                await TWILIO_CLIENT.conversations.v1
                    .conversations(payload.ConversationSid)
                    .fetch(),
        );
        const attributes = JSON.parse(conversation.attributes ?? "{}");
        const leadIds = attributes["LeadIds"] ?? [];
        this.restateContext.console.log(`Executing 'close' for ${leadIds.length} lead(s)`, {
            _meta: 1,
            TwilioConversationSID: conversation.sid,
            LeadIds: leadIds,
        });
        for (const leadId of leadIds) {
            this.restateContext.objectSendClient(LeadVirtualObject, leadId).close({
                reason: "Inactivity",
            }, restate.rpc.sendOpts({
                headers: {
                    "authorization": process.env.INTERNAL_API_TOKEN!
                }
            }));
        }
    }
    private async onIncomingMessage(leadId: string, payload: TwilioMessagingServiceBody): Promise<any> {
        if (payload.OptOutType === "START") {
            this.restateContext.console.log(`Received 'OPT-IN' for ${payload.From}`, {
                _meta: 1,
                PhoneNumber: payload.From,
                Operation: "OPT-IN",
            });
            const result = await this.handleOptInMessage(this.restateContext, payload);
            this.restateContext.console.log(`Processed 'OPT-IN' for ${payload.From}`, {
                _meta: 1,
                PhoneNumber: payload.From,
                Operation: "OPT-IN",
            });
            return result;
        }
        // Close any active leads on opt-out
        if (payload.OptOutType === "STOP") {
            this.restateContext.console.log(`Received 'OPT-OUT' for ${payload.From}`, {
                _meta: 1,
                PhoneNumber: payload.From,
                Operation: "OPT-OUT",
            });
            const result = await this.handleOptOutMessage(this.restateContext, payload);
            this.restateContext.console.log(`Processed 'OPT-OUT' for ${payload.From}`, {
                _meta: 1,
                PhoneNumber: payload.From,
                Operation: "OPT-OUT",
            });
            return result;
        }
        return await this.handleClosedMessagingThread(this.restateContext, payload);
    }
    private async handleOptInMessage(
        ctx: restate.Context,
        data: TwilioMessagingServiceBody,
    ) {
        await ctx.run("Handle opt-in message", async () => {
            const optOutEntry = await OptedOutNumberModel.get(data.From);
            if (optOutEntry == null) return;
            if (optOutEntry.OptedOutNumbers[data.To] == null) return;
            delete optOutEntry.OptedOutNumbers[data.To];
            if (Object.keys(optOutEntry.OptedOutNumbers).length === 0) {
                return await optOutEntry.delete();
            }
            return await optOutEntry.save();
        });
    }
    private async handleOptOutMessage(
        ctx: restate.Context,
        data: TwilioMessagingServiceBody,
    ) {
        const conversations = await ctx.run("Find twilio conversation", async () =>
            TwilioConversationHelpers.FindConversationsFor(
                globalThis.TWILIO_CLIENT,
                data.From,
                ["active", "inactive"],
            ),
        );
        const optOutEntry = await ctx.run(
            "Get Opted-Out number entry",
            async () => await OptedOutNumberModel.get(data.From),
        );
        const optedOutNumbers = optOutEntry?.OptedOutNumbers ?? {};
        // Return early if this number is already opted out
        if (optedOutNumbers[data.To] != null) return;
        const now = await ctx.date.now();
        await ctx.run(
            "Add opted-out number",
            async () =>
                await OptedOutNumberModel.create(
                    {
                        PhoneNumber: data.From,
                        OptedOutNumbers: {
                            ...optedOutNumbers,
                            [data.To]: {
                                OptOutRequest: data,
                                DateOptedOut: new Date(now).toISOString(),
                            },
                        },
                    },
                    { overwrite: true },
                ),
        );
        let isDealer = false;
        for (const conversation of conversations) {
            if (conversation.state === "closed") continue;
            const attributes = JSON.parse(conversation.attributes ?? "{}");
            // Don't close lead if dealer opts out for some reason
            if (attributes["StorePhoneNumber"] === data.From) {
                isDealer = true;
                continue;
            }
            const leadIds: string[] = attributes["LeadIds"] ?? [];
            for (const leadId of leadIds) {
                ctx.objectSendClient(LeadVirtualObject, leadId).close({
                    reason: "Participant opted out of text messaging",
                }, restate.rpc.sendOpts({
                    headers: {
                        "authorization": process.env.INTERNAL_API_TOKEN!
                    }
                }));
            }
        }
        if (isDealer) {
            return new MessagingResponse().message(
                "WARNING: You have opted out of Web2Text messages. If this was an error, text START to opt back in. If you intended to opt out, please contact your account manager immediately, as this may negatively impact your business.",
            );
        }
    }
    private async handleClosedMessagingThread(
        ctx: restate.Context,
        data: TwilioMessagingServiceBody,
    ): Promise<string | undefined> {
        const conversations = await ctx.run("Find twilio conversation", async () =>
            TwilioConversationHelpers.FindConversationsFor(
                globalThis.TWILIO_CLIENT,
                data.From,
                ["active", "closed", "inactive"],
            ),
        );
        if (conversations.length === 0) return;
        if (conversations.find((c) => c.state === "active" || c.state === "inactive"))
            return;
    
        // If we get a message from a number that doesn't have any active conversations, but has in the past
        // Send them a closing message to let them know the thread has ended
        const lastActiveConversation = conversations[0];
        const attributes = JSON.parse(lastActiveConversation.attributes ?? "{}");
        const storePhoneNumber = attributes?.["StorePhoneNumber"];
        let closingMessage: string;
        if (data.From === storePhoneNumber) {
            const customerName = attributes?.["CustomerName"];
            closingMessage = DealerCloseMessage(customerName);
        } else {
            const dealerName = attributes?.["DealerName"];
            const dealerWebsite = attributes?.["DealerURL"];
            closingMessage = CustomerCloseMessage(
                dealerName,
                dealerWebsite,
                storePhoneNumber,
            );
        }
        return new MessagingResponse().message(closingMessage).toString();
    }
}