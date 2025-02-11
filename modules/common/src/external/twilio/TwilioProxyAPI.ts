import ky, { type HTTPError } from "ky";
import type { E164Number } from "libphonenumber-js";
import { assert, is } from "tsafe";
import type {
	ConversationInstance,
	ConversationListInstanceCreateOptions,
} from "twilio/lib/rest/conversations/v1/conversation";
import { TWILIO_PROXY_AUTHORIZATION_HEADERS } from ".";
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
		throw new Error(
			`Failed to create Twilio Proxy for '[${phoneNumbers.join(",")}]'`,
			{
				cause: new Error(await e.response.text().catch((_) => "Unknown"), {
					cause: e,
				}),
			},
		);
	}
}
