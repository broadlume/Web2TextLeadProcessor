import { TwilioWebhookHandler } from "#external/twilio/web2text/TwilioWebhookHandler";
import { FormUrlEncodedSerde } from "common/restate";
import type { WebhookHandler } from "./WebhookHandler"
import * as restate from '@restatedev/restate-sdk';

interface WebhookTypeInfoItem {
    handler: new <T extends restate.TypedState | restate.UntypedState>(ctx: restate.ObjectSharedContext<T>) => WebhookHandler<any>
    input: restate.Serde<any>
    allowSubscribe: boolean
}
export type WebhookType = "twilio" | "lead";
export const WebhookTypeInfo: Record<WebhookType, WebhookTypeInfoItem> = {
    "twilio": {
        handler: TwilioWebhookHandler,
        input: new FormUrlEncodedSerde(),
        allowSubscribe: false,
    },
    "lead": {
        handler: LeadWebhookHandler,
        input: restate.serde.json,
        allowSubscribe: true,
    }
} as const;
