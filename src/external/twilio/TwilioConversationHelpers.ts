import type { E164Number } from "libphonenumber-js";
import type { Twilio } from "twilio";
import type { ParticipantConversationInstance } from "twilio/lib/rest/conversations/v1/participantConversation";

/**
 * Return a list of conversations this phone number is in, sorted by date updated descending
 * @param twilioClient the twilio API client
 * @param phone the phone to find conversations it is a participant in
 * @param statuses the statuses of the conversations to filter for, optional
 * @returns a list of conversations this phone number is a participant in
 */
export async function FindConversationsFor(
    twilioClient: Twilio,
    phone: E164Number,
    statuses: ("active" | "inactive" | "closed")[] = ["active","inactive"]
): Promise<ParticipantConversationInstance[]> {
    return await twilioClient.conversations.v1.participantConversations
            .list({
                address: phone,
            })
            .then((convos) =>
                convos
                    .filter((c) => statuses.includes(c.conversationState))
                    .sort((a,b) => b.conversationDateUpdated.getTime() - a.conversationDateUpdated.getTime()),
            );
}