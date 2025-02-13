import * as restate from "@restatedev/restate-sdk";
import { RESTATE_INGRESS_URL } from "common/external/restate";
import { TwilioConversationHelpers } from "common/external/twilio";
import { FormUrlEncodedSerde, XMLSerde } from "common/restate";
import parsePhoneNumber, { type E164Number } from "libphonenumber-js";
import { assert, is } from "tsafe";
import MessagingResponse from "twilio/lib/twiml/MessagingResponse";
import { validateRequest } from "twilio/lib/webhooks/webhooks";
import { OptedOutNumberModel } from "../../dynamodb/OptedOutNumberModel";
import {
	CustomerCloseMessage,
	DealerCloseMessage,
} from "../../external/twilio/Web2TextMessagingStrings";
import { CheckAuthorization } from "../validators";
import { LeadVirtualObject } from "./LeadVirtualObject";

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
				ctx.console.log(`Executing 'sync' for ${leadIds.length} lead(s)`, {
					_meta: 1,
					TwilioConversationSID: conversation.sid,
					LeadIds: leadIds,
				});
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
				ctx.console.log(`Executing 'close' for ${leadIds.length} lead(s)`, {
					_meta: 1,
					TwilioConversationSID: conversation.sid,
					LeadIds: leadIds,
				});
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
					ctx.console.log(`Received 'OPT-IN' for ${data.From}`, {
						_meta: 1,
						PhoneNumber: data.From,
						Operation: "OPT-IN",
					});
					const result = await HandleOptInMessage(ctx, data);
					ctx.console.log(`Processed 'OPT-IN' for ${data.From}`, {
						_meta: 1,
						PhoneNumber: data.From,
						Operation: "OPT-IN",
					});
					return result;
				}
				// Close any active leads on opt-out
				if (data.OptOutType === "STOP") {
					ctx.console.log(`Received 'OPT-OUT' for ${data.From}`, {
						_meta: 1,
						PhoneNumber: data.From,
						Operation: "OPT-OUT",
					});
					const result = await HandleOptOutMessage(ctx, data);
					ctx.console.log(`Processed 'OPT-OUT' for ${data.From}`, {
						_meta: 1,
						PhoneNumber: data.From,
						Operation: "OPT-OUT",
					});
					return result;
				}
				return await HandleClosedMessagingThread(ctx, data);
			},
		),
		checkOptInStatus: restate.handlers.handler(
			{},
			async (
				ctx: restate.Context,
				req: Record<string, any>,
			): Promise<{
				Status: "OPTED-IN" | "OPTED-OUT";
				OptInNumbers?: E164Number[];
			}> => {
				await CheckAuthorization(
					ctx as unknown as restate.ObjectSharedContext,
					`${TwilioWebhooks.name}/getOptInNumber`,
					ctx.request().headers.get("authorization") ?? req?.["API_KEY"],
				);

				const phoneNumber = parsePhoneNumber(req["PhoneNumber"], "US");
				if (phoneNumber === undefined) {
					throw new restate.TerminalError(
						"'PhoneNumber' in POST body is missing or invalid",
						{
							errorCode: 400,
						},
					);
				}
				const optOut = await ctx.run(
					"Fetch Opt-Out request",
					async () => await OptedOutNumberModel.get(phoneNumber!.number),
				);
				if (optOut == null) {
					return {
						Status: "OPTED-IN",
					};
				}
				const optInNumbers = Object.keys(
					optOut.OptedOutNumbers,
				) as E164Number[];
				return {
					Status: "OPTED-OUT",
					OptInNumbers: optInNumbers,
				};
			},
		),
	},
});

async function HandleOptInMessage(
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
async function HandleOptOutMessage(
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
