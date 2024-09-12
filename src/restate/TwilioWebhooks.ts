import * as restate from "@restatedev/restate-sdk";
import { FormUrlEncodedSerde } from "./FormUrlEncodedSerde";
import {validateRequest} from "twilio";
import { LeadVirtualObject } from "./LeadVirtualObject";
import { assert, is } from "tsafe";

interface TwilioWebhookBody {
    AccountSid: string,
    EventType: string,
    Source: string,
    ClientIdentity: string,
}

type TwilioMessageWebhookBody = TwilioWebhookBody & {
    Author: string;
    Body: string;
    MessageSid: string;
    ConversationSid: string;
}
type TwilioConversationStateUpdatedWebhookBody = TwilioWebhookBody & {
    StateFrom: string;
    StateTo: string;
    Reason: string;
    ConversationSid: string;
}
function ValidateTwilioRequest(twilioHeader: string | undefined, data: object, leadId: string, endpoint: "sync" | "close") {
    
    if (twilioHeader == null) {
        throw new restate.TerminalError("Twilio auth header missing");
    }
    const thisUrl = new URL(`${TwilioWebhooks.name}/${leadId}/${endpoint}`,process.env.RESTATE_ADMIN_URL);
    thisUrl.port = "";
    if (!validateRequest(process.env.TWILIO_AUTH_TOKEN,twilioHeader,thisUrl.toString(),data)) {
        throw new restate.TerminalError("Twilio request validation failed");
    }
}
export const TwilioWebhooks = restate.object({
	name: "TwilioWebhooks",
	handlers: {
        sync: restate.handlers.object.exclusive({
            input: new FormUrlEncodedSerde()
        }, async (ctx: restate.ObjectContext, data: object) => {
            const twilioHeader = ctx.request().headers.get("x-twilio-signature") ?? ctx.request().headers.get("X-Twilio-Signature");
            ValidateTwilioRequest(twilioHeader,data,ctx.key, "sync");
            ctx.objectSendClient(LeadVirtualObject,ctx.key).sync(process.env.INTERNAL_TOKEN);
        }),
        close: restate.handlers.object.exclusive({
            input: new FormUrlEncodedSerde()
        }, async (ctx: restate.ObjectContext, data: object) => {
            const twilioHeader = ctx.request().headers.get("x-twilio-signature") ?? ctx.request().headers.get("X-Twilio-Signature");
            ValidateTwilioRequest(twilioHeader,data,ctx.key, "close");
            assert(is<TwilioConversationStateUpdatedWebhookBody | TwilioMessageWebhookBody>(data));
            if ("StateTo" in data) {
                if (data.StateTo !== "closed") {
                    return;
                }
            }
            else {
                // Todo: figure out how to close on opt-out messages
                return;
            }
            ctx.objectSendClient(LeadVirtualObject,ctx.key).close(process.env.INTERNAL_TOKEN);
        }),
    },
});
