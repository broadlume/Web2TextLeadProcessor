import { HttpResponse, http } from "msw";

export const twilioApiHandlers = [
    http.get("https://lookups.twilio.com/v2/PhoneNumbers/:phoneNumber", (request) => {
        const phoneNumber = request.params.phoneNumber;
        return HttpResponse.json({
            calling_country_code: "1",
            country_code: "US",
            phone_number: phoneNumber,
            valid: true,
            validation_errors: null,
            caller_name: null,
            sim_swap: null,
            call_forwarding: null,
            line_status: null,
            line_type_intelligence: {
                error_code: null,
                mobile_country_code: "240",
                mobile_network_code: "38",
                carrier_name: "Twilio - SMS/MMS-SVR",
                type: "mobile",
            },
            identity_match: null,
            reassigned_number: null,
            sms_pumping_risk: null,
            phone_number_quality_score: null,
            pre_fill: null,
            url: "https://lookups.twilio.com/v2/PhoneNumbers/+14159929960",
        });
    }),
    http.post("https://conversations.twilio.com/*", () => {
        return HttpResponse.json({ sid: "test-conversation-sid" });
    }),
    http.get("https://conversations.twilio.com/v1/ParticipantConversations", () => {
        return HttpResponse.json({
            resources: [
                {
                    conversation_sid: "test-conversation-sid",
                    conversation_state: "active",
                    participant_sid: "test-participant-sid",
                    participant_user_sid: null,
                    participant_identity: null,
                    participant_messaging_binding: {
                        type: "sms",
                        address: "+1234567890",
                    },
                },
            ],
            meta: {
                page: 0,
                page_size: 50,
                first_page_url: "https://conversations.twilio.com/v1/ParticipantConversations?PageSize=50&Page=0",
                previous_page_url: null,
                next_page_url: null,
                key: "resources",
            },
        });
    }),
    http.get("https://conversations.twilio.com/v1/Conversations/:conversationSid", () => {
        return HttpResponse.json({
            sid: "test-conversation-sid",
            state: "active",
            messaging_service_sid: process.env.TWILIO_MESSAGING_SERVICE_SID || "test-messaging-service-sid",
        });
    }),
    http.get("https://conversations.twilio.com/v1/Conversations/:conversationSid/Participants", () => {
        return HttpResponse.json({
            resources: [
                {
                    sid: "test-participant-sid",
                    conversation_sid: "test-conversation-sid",
                    identity: null,
                    messaging_binding: {
                        type: "sms",
                        address: "+1234567890",
                    },
                },
            ],
            meta: {
                page: 0,
                page_size: 50,
                first_page_url:
                    "https://conversations.twilio.com/v1/Conversations/test-conversation-sid/Participants?PageSize=50&Page=0",
                previous_page_url: null,
                next_page_url: null,
                key: "resources",
            },
        });
    }),
    http.get("https://conversations.twilio.com/v1/Conversations/:conversationSid/Messages/:messageSid/Receipts", () => {
        return HttpResponse.json({
            resources: [],
            meta: {
                page: 0,
                page_size: 50,
                first_page_url:
                    "https://conversations.twilio.com/v1/Conversations/test-conversation-sid/Messages/test-message-sid/Receipts?PageSize=50&Page=0",
                previous_page_url: null,
                next_page_url: null,
                key: "resources",
            },
        });
    }),
    http.get("https://conversations.twilio.com/v1/Conversations/:conversationSid/Webhooks", () => {
        return HttpResponse.json({
            resources: [],
            meta: {
                page: 0,
                page_size: 50,
                first_page_url:
                    "https://conversations.twilio.com/v1/Conversations/test-conversation-sid/Webhooks?PageSize=50&Page=0",
                previous_page_url: null,
                next_page_url: null,
                key: "resources",
            },
        });
    }),
    http.patch("https://conversations.twilio.com/*", () => {
        return HttpResponse.json({ state: "closed" });
    }),
];
