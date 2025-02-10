import ky, { HTTPError } from "ky";
import type { E164Number } from "libphonenumber-js";
import type {
	ConversationInstance,
	ConversationListInstanceCreateOptions,
} from "twilio/lib/rest/conversations/v1/conversation";
import { TWILIO_PROXY_AUTHORIZATION_HEADERS } from ".";
import { logger } from "../../logger";
import { assert, is } from "tsafe";

export async function CreateSession(
	phoneNumbers: E164Number[],
	conversationOptions?: ConversationListInstanceCreateOptions,
): Promise<ConversationInstance> {
	const proxyAPIUrl = new URL(process.env.TWILIO_PROXY_URL);
	proxyAPIUrl.pathname += "sessions";
	try {
		const response = await ky
			.post(proxyAPIUrl.toString(), {
				headers: TWILIO_PROXY_AUTHORIZATION_HEADERS(),
				json: {
					addresses: phoneNumbers,
					...conversationOptions,
				},
				retry: 0,
			})
			.json<ConversationInstance>();
		return response;
	} catch (e) {
		assert(is<HTTPError>(e));
		logger
			.child({ label: "TwilioProxyAPI:CreateSession" })
			.warn(`Failed to create Twilio Proxy for '[${phoneNumbers.join(",")}]'`, {_meta: 1, Error: e, Reason: await e.response.text().catch(_ => "Unknown")});
		throw e;
	}
}
