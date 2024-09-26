import type { E164Number } from "libphonenumber-js";
import type { Twilio } from "twilio";
import type { ParticipantConversationInstance } from "twilio/lib/rest/conversations/v1/participantConversation";

/**
 * Return a list of conversations this phone number is in, sorted by date updated descending
 * @param twilioClient the twilio API client
 * @param phone the phone to find conversations it is a participant in, or an array of phone numbers to find conversations that all the numbers are in
 * @param statuses the statuses of the conversations to filter for, optional
 * @returns a list of conversations this phone number is a participant in
 */
export async function FindConversationsFor(
    twilioClient: Twilio,
    phone: E164Number | E164Number[],
    statuses: ("active" | "inactive" | "closed")[] = ["active","inactive"]
): Promise<ParticipantConversationInstance[]> {
    const [firstPhoneNumber,...restOfNumbers] = [phone].flat();
    // Find all conversations the first phone number is in
    let conversations: ParticipantConversationInstance[] = await twilioClient.conversations.v1.participantConversations
    .list({
        address: firstPhoneNumber,
    });
    // Filter down that original list for each other phone number until we achieve the list of conversations that all of the phone numbers are in
    for (const otherNumber of restOfNumbers ?? []) {
        if (conversations.length === 0) return [];
        const otherConversationSIDs: string[] = await twilioClient.conversations.v1.participantConversations
        .list({
            address: otherNumber,
        }).then(c => c.map(c => c.conversationSid));
        conversations = conversations.filter(convo => otherConversationSIDs.includes(convo.conversationSid));
    }
    return conversations
    .filter((c) => statuses.includes(c.conversationState))
    .sort((a,b) => b.conversationDateUpdated.getTime() - a.conversationDateUpdated.getTime())
}