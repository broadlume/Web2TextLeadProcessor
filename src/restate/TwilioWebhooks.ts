import * as restate from "@restatedev/restate-sdk";
import { FormUrlEncodedSerde } from "./FormUrlEncodedSerde";
import { Twilio, validateRequest } from "twilio";
import { LeadVirtualObject } from "./LeadVirtualObject";
import { assert, is } from "tsafe";
import { FindConversationFor } from "../external/twilio/TwilioConversationHelpers";
import type { E164Number } from "libphonenumber-js";

interface TwilioWebhookBody {
	AccountSid: string;
	EventType: string;
	Source: string;
	ClientIdentity: string;
}

type TwilioMessageWebhookBody = TwilioWebhookBody & {
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

interface TwilioMessagingServiceBody {
	MessageSid: string;
	From: E164Number;
	To: E164Number;
	Body: string;
	OptOutType?: "START" | "STOP" | "HELP";
}
function ValidateTwilioRequest(
	twilioHeader: string | undefined,
	data: object,
	leadId: string,
	endpoint: string,
) {
	if (twilioHeader == null) {
		throw new restate.TerminalError("Twilio auth header missing");
	}
	const thisUrl = new URL(
		`${TwilioWebhooks.name}/${leadId}/${endpoint}`,
		process.env.RESTATE_ADMIN_URL,
	);
	thisUrl.port = "";
	if (
		!validateRequest(
			process.env.TWILIO_AUTH_TOKEN,
			twilioHeader,
			thisUrl.toString(),
			data,
		)
	) {
		throw new restate.TerminalError("Twilio request validation failed");
	}
}
const twilioClient = new Twilio(
	process.env.TWILIO_ACCOUNT_SID,
	process.env.TWILIO_AUTH_TOKEN,
);
export const TwilioWebhooks = restate.object({
	name: "TwilioWebhooks",
	handlers: {
		sync: restate.handlers.object.exclusive(
			{
				input: new FormUrlEncodedSerde(),
			},
			async (ctx: restate.ObjectContext, data: object) => {
				const twilioHeader =
					ctx.request().headers.get("x-twilio-signature") ??
					ctx.request().headers.get("X-Twilio-Signature");
				ValidateTwilioRequest(twilioHeader, data, ctx.key, "sync");
				ctx
					.objectSendClient(LeadVirtualObject, ctx.key)
					.sync(null, process.env.INTERNAL_TOKEN);
			},
		),
		close: restate.handlers.object.exclusive(
			{
				input: new FormUrlEncodedSerde(),
			},
			async (ctx: restate.ObjectContext, data: object) => {
				const twilioHeader =
					ctx.request().headers.get("x-twilio-signature") ??
					ctx.request().headers.get("X-Twilio-Signature");
				ValidateTwilioRequest(twilioHeader, data, ctx.key, "close");
				assert(is<TwilioConversationStateUpdatedWebhookBody>(data));
				if (data.StateTo !== "closed") {
					return;
				}
				ctx
					.objectSendClient(LeadVirtualObject, ctx.key)
					.close(
						{
							reason:
								"Twilio Close Webhook - conversation state was set to 'closed'",
						},
						process.env.INTERNAL_TOKEN,
					);
			},
		),
		checkOptOut: restate.handlers.object.shared(
			{
				input: new FormUrlEncodedSerde(),
			},
			async (ctx: restate.ObjectSharedContext, data: object) => {
				if (ctx.key !== "global") {
					throw new restate.TerminalError(
						"The object key must be 'global' for this endpoint",
					);
				}
				const twilioHeader =
					ctx.request().headers.get("x-twilio-signature") ??
					ctx.request().headers.get("X-Twilio-Signature");

				assert(is<TwilioMessagingServiceBody>(data));
				ValidateTwilioRequest(twilioHeader, data, ctx.key, "checkOptOut");
				if (data.OptOutType !== "STOP") return;

				const participantConversations = await FindConversationFor(
					twilioClient,
					data.From,
				);
				for (const participantConversation of participantConversations) {
					const attributes = JSON.parse(
						participantConversation.conversationAttributes ?? "{}",
					);
					const leadIds: string[] = attributes["LeadIds"] ?? [];
					for (const leadId of leadIds) {
						ctx
							.objectSendClient(LeadVirtualObject, leadId)
							.close(
								{
									reason:
										"Twilio OptOut Webhook - customer opted out of text messaging",
								},
								process.env.INTERNAL_TOKEN,
							);
					}
				}
			},
		),
	},
});
