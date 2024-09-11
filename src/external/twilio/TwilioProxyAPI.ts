import type { E164Number } from "libphonenumber-js";
import type {
	ConversationInstance,
	ConversationListInstanceCreateOptions,
} from "twilio/lib/rest/conversations/v1/conversation";
import { TWILIO_PROXY_AUTHORIZATION_HEADERS } from ".";
import ky from "ky";

export async function CreateSession(
	phoneNumbers: E164Number[],
	conversationOptions?: ConversationListInstanceCreateOptions,
): Promise<ConversationInstance> {
	const proxyAPIUrl = new URL(process.env.TWILIO_PROXY_URL);
	proxyAPIUrl.pathname += "sessions";
	try {
		const response = await ky.post(proxyAPIUrl.toString(), {
			headers: TWILIO_PROXY_AUTHORIZATION_HEADERS(),
			json: {
				addresses: phoneNumbers,
				...conversationOptions,
			},
			retry: 0
		}).json<ConversationInstance>();
		return response;
	} catch (e) {
		Logger.warn(`[TwilioProxyAPI.CreateSession] Failed to create Twilio Proxy for '[${phoneNumbers.join(",")}]'`);
		throw e;
	}
}
