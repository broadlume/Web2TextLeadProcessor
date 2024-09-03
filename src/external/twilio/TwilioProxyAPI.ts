import type { E164Number } from "libphonenumber-js";
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

	const response = await fetch(proxyAPIUrl.toString(), {
		method: "POST",
		headers: TWILIO_PROXY_AUTHORIZATION_HEADERS(),
		body: JSON.stringify({
			addresses: phoneNumbers,
			...conversationOptions,
		}),
	});

	if (response.ok) {
		return (await response.json()) as ConversationInstance;
	}
	const error = await response.text().catch(() => response.status);
	throw new Error(
		`Failed to create Twilio Proxy for '[${phoneNumbers.join(",")}]'`,
		{ cause: error },
	);
}
