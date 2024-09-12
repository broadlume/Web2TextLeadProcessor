import type { E164Number } from "libphonenumber-js";
import type { Twilio } from "twilio";
import type { ParticipantConversationInstance } from "twilio/lib/rest/conversations/v1/participantConversation";

export async function FindConversationFor(
    twilioClient: Twilio,
    phone: E164Number,
): Promise<ParticipantConversationInstance[]> {
    return await twilioClient.conversations.v1.participantConversations
            .list({
                address: phone,
            })
            .then((convos) =>
                convos
                    .filter((c) => c.conversationState !== "closed"),
            );
}