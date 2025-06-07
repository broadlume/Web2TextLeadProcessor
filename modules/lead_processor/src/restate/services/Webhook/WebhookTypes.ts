import type * as restate from "@restatedev/restate-sdk";
import { FormUrlEncodedSerde } from "common/restate";
import { TwilioWebhookHandler } from "#external/twilio/web2text/TwilioWebhookHandler";
import type { WebhookHandler } from "./WebhookHandler";

interface WebhookTypeInfoItem {
    handler: new <T extends restate.TypedState | restate.UntypedState>(
        ctx: restate.ObjectSharedContext<T>,
    ) => WebhookHandler<any>;
    input: restate.Serde<any>;
    allowSubscribe: boolean;
}
export type WebhookType = "twilio";
export const WebhookTypeInfo: Record<WebhookType, WebhookTypeInfoItem> = {
    twilio: {
        handler: TwilioWebhookHandler,
        input: new FormUrlEncodedSerde(),
        allowSubscribe: false,
    },
} as const;
