import * as restate from "@restatedev/restate-sdk";
import { FormUrlEncodedSerde } from "./FormUrlEncodedSerde";
import { Twilio, validateRequest } from "twilio";
import { LeadVirtualObject } from "./LeadVirtualObject";
import { assert, is } from "tsafe";
import { FindConversationsFor } from "../external/twilio/TwilioConversationHelpers";
import type { E164Number } from "libphonenumber-js";
import { OptedOutNumberModel } from "../dynamodb/OptedOutNumberModel";
import MessagingResponse from "twilio/lib/twiml/MessagingResponse";
import { CustomerCloseMessage, DealerCloseMessage } from "../external/twilio/Web2TextMessagingStrings";
import { XMLSerde } from "./XMLSerde";

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
					.sync({ API_KEY: process.env.INTERNAL_API_TOKEN });
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
				ctx.objectSendClient(LeadVirtualObject, ctx.key).close({
					reason: "Inactivity",
					API_KEY: process.env.INTERNAL_API_TOKEN,
				});
			},
		),
		onIncomingMessage: restate.handlers.object.shared(
			{
				input: new FormUrlEncodedSerde(),
				output: new XMLSerde(),
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
				ValidateTwilioRequest(twilioHeader, data, ctx.key, "onIncomingMessage");
				if (data.OptOutType === "START") {
					return await HandleOptInMessage(ctx, data);
				}
				// Close any active leads on opt-out
				if (data.OptOutType === "STOP") {
					return await HandleOptOutMessage(ctx, data);
				}
				return await HandleClosedMessagingThread(ctx,data);
			},
		),
	},
});

async function HandleOptInMessage(
	ctx: restate.ObjectSharedContext,
	data: TwilioMessagingServiceBody,
) {
	await ctx.run(
		"Remove opted-out number",
		async () => await OptedOutNumberModel.delete(data.From),
	);
}
async function HandleOptOutMessage(
	ctx: restate.ObjectSharedContext,
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
	await ctx.run(
		"Add opted-out number",
		async () =>
			await OptedOutNumberModel.create(
				{
					PhoneNumber: data.From,
					DateOptedOut: new Date(now).toISOString(),
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
		const leadIds: string[] = attributes["LeadIDs"] ?? [];
		for (const leadId of leadIds) {
			ctx.objectSendClient(LeadVirtualObject, leadId).close({
				reason: "Participant opted out of text messaging",
				API_KEY: process.env.INTERNAL_API_TOKEN,
			});
		}
	}
	if (isDealer) {
		return new MessagingResponse().message("WARNING: You have opted out of Web2Text messages. If this was an error, text START to opt back in. If you intended to opt out, please contact your account manager immediately, as this may negatively impact your business.");
	}
}
async function HandleClosedMessagingThread(
	ctx: restate.ObjectSharedContext,
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
	const dealerPhoneNumber = attributes?.["StorePhoneNumber"];
	let closingMessage: string;
	if (data.From === dealerPhoneNumber) {
		const customerName = attributes?.["CustomerName"];
		closingMessage = DealerCloseMessage(customerName);
	}	
	else {
		const dealerName = attributes?.["DealerName"];
		const dealerWebsite = attributes?.["DealerURL"];
		closingMessage = CustomerCloseMessage(
			dealerName,
			dealerWebsite,
			dealerPhoneNumber,
		);
	}
	return new MessagingResponse().message(closingMessage).toString();

}
