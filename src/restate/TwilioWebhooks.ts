import * as restate from "@restatedev/restate-sdk";
import type { E164Number } from "libphonenumber-js";
import { assert, is } from "tsafe";
import { validateRequest } from "twilio";
import MessagingResponse from "twilio/lib/twiml/MessagingResponse";
import { OptedOutNumberModel } from "../dynamodb/OptedOutNumberModel";
import { RESTATE_INGRESS_URL } from "../external/restate";
import { FindConversationsFor } from "../external/twilio/TwilioConversationHelpers";
import {
	CustomerCloseMessage,
	DealerCloseMessage,
} from "../external/twilio/Web2TextMessagingStrings";
import { logger as _logger } from "../logger";
import { FormUrlEncodedSerde } from "./FormUrlEncodedSerde";
import { LeadVirtualObject } from "./LeadVirtualObject";
import { XMLSerde } from "./XMLSerde";

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
function ValidateTwilioRequest(
	twilioHeader: string | undefined,
	data: object,
	endpoint: string,
) {
	if (twilioHeader == null) {
		throw new restate.TerminalError("Twilio auth header missing");
	}
	const thisUrl = new URL(
		`${TwilioWebhooks.name}/${endpoint}`,
		RESTATE_INGRESS_URL,
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
const logger = _logger.child({ label: "TwilioWebhooks" });
export const TwilioWebhooks = restate.service({
	name: "TwilioWebhooks",
	handlers: {
		sync: restate.handlers.handler(
			{
				input: new FormUrlEncodedSerde(),
			},
			async (ctx: restate.Context, data: object) => {
				const twilioHeader =
					ctx.request().headers.get("x-twilio-signature") ??
					ctx.request().headers.get("X-Twilio-Signature");
				ValidateTwilioRequest(twilioHeader, data, "sync");
				assert(is<TwilioConversationMessageWebhookBody>(data));
				const conversation = await ctx.run(
					"Fetch Twilio conversation",
					async () =>
						await TWILIO_CLIENT.conversations.v1
							.conversations(data.ConversationSid)
							.fetch(),
				);
				const attributes = JSON.parse(conversation.attributes ?? "{}");
				const leadIds = attributes["LeadIds"] ?? [];
				for (const leadId of leadIds) {
					ctx
						.objectSendClient(LeadVirtualObject, leadId)
						.sync({ API_KEY: process.env.INTERNAL_API_TOKEN });
				}
			},
		),
		close: restate.handlers.handler(
			{
				input: new FormUrlEncodedSerde(),
			},
			async (ctx: restate.Context, data: object) => {
				const twilioHeader =
					ctx.request().headers.get("x-twilio-signature") ??
					ctx.request().headers.get("X-Twilio-Signature");
				ValidateTwilioRequest(twilioHeader, data, "close");
				assert(is<TwilioConversationStateUpdatedWebhookBody>(data));
				const conversation = await ctx.run(
					"Fetch Twilio conversation",
					async () =>
						await TWILIO_CLIENT.conversations.v1
							.conversations(data.ConversationSid)
							.fetch(),
				);
				const attributes = JSON.parse(conversation.attributes ?? "{}");
				const leadIds = attributes["LeadIds"] ?? [];
				for (const leadId of leadIds) {
					ctx.objectSendClient(LeadVirtualObject, leadId).close({
						reason: "Inactivity",
						API_KEY: process.env.INTERNAL_API_TOKEN,
					});
				}
			},
		),
		onIncomingMessage: restate.handlers.handler(
			{
				input: new FormUrlEncodedSerde(),
				output: new XMLSerde(),
			},
			async (ctx: restate.Context, data: object) => {
				const twilioHeader =
					ctx.request().headers.get("x-twilio-signature") ??
					ctx.request().headers.get("X-Twilio-Signature");

				assert(is<TwilioMessagingServiceBody>(data));
				ValidateTwilioRequest(twilioHeader, data, "onIncomingMessage");
				if (data.OptOutType === "START") {
					logger
						.child({ PhoneNumber: data.From, Operation: "OPT-IN" })
						.info(`Received 'OPT-IN' for ${data.From}`);
					const result = await HandleOptInMessage(ctx, data);
					logger
						.child({ PhoneNumber: data.From, Operation: "OPT-IN" })
						.info(`Processed 'OPT-IN' for ${data.From}`);
					return result;
				}
				// Close any active leads on opt-out
				if (data.OptOutType === "STOP") {
					logger
						.child({ PhoneNumber: data.From, Operation: "OPT-OUT" })
						.info(`Received 'OPT-OUT' for ${data.From}`);
					const result = await HandleOptOutMessage(ctx, data);
					logger
						.child({ PhoneNumber: data.From, Operation: "OPT-OUT" })
						.info(`Processed 'OPT-OUT' for ${data.From}`);
					return result;
				}
				return await HandleClosedMessagingThread(ctx, data);
			},
		),
	},
});

async function HandleOptInMessage(
	ctx: restate.Context,
	data: TwilioMessagingServiceBody,
) {
	await ctx.run(
		"Remove opted-out number",
		async () => await OptedOutNumberModel.delete(data.From),
	);
}
async function HandleOptOutMessage(
	ctx: restate.Context,
	data: TwilioMessagingServiceBody,
) {
	const participantConversations = await ctx.run(
		"Find twilio conversation",
		async () =>
			FindConversationsFor(globalThis.TWILIO_CLIENT, data.From, [
				"active",
				"closed",
				"inactive",
			]),
	);
	const now = await ctx.date.now();
	ctx.console.log(data);
	await ctx.run(
		"Add opted-out number",
		async () =>
			await OptedOutNumberModel.create(
				{
					PhoneNumber: data.From,
					DateOptedOut: new Date(now).toISOString(),
					OptOutRequest: data
				},
				{ overwrite: true },
			),
	);
	let isDealer = false;
	for (const participantConversation of participantConversations) {
		if (participantConversation.conversationState === "closed") continue;
		const attributes = JSON.parse(
			participantConversation.conversationAttributes ?? "{}",
		);
		// Don't close lead if dealer opts out for some reason
		if (attributes["StorePhoneNumber"] === data.From) {
			isDealer = true;
			continue;
		}
		const leadIds: string[] = attributes["LeadIds"] ?? [];
		for (const leadId of leadIds) {
			ctx.objectSendClient(LeadVirtualObject, leadId).close({
				reason: "Participant opted out of text messaging",
				API_KEY: process.env.INTERNAL_API_TOKEN,
			});
		}
	}
	if (isDealer) {
		return new MessagingResponse().message(
			"WARNING: You have opted out of Web2Text messages. If this was an error, text START to opt back in. If you intended to opt out, please contact your account manager immediately, as this may negatively impact your business.",
		);
	}
}
async function HandleClosedMessagingThread(
	ctx: restate.Context,
	data: TwilioMessagingServiceBody,
): Promise<string | undefined> {
	const participantConversations = await ctx.run(
		"Find twilio conversation",
		async () =>
			FindConversationsFor(globalThis.TWILIO_CLIENT, data.From, [
				"active",
				"closed",
				"inactive",
			]),
	);
	if (participantConversations.length === 0) return;
	if (participantConversations.find((c) => c.conversationState === "active"))
		return;

	// If we get a message from a number that doesn't have any active conversations, but has in the past
	// Send them a closing message to let them know the thread has ended
	const lastActiveConversation = participantConversations[0];
	const attributes = JSON.parse(
		lastActiveConversation.conversationAttributes ?? "{}",
	);
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
