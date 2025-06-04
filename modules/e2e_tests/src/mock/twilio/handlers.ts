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
    http.get("https://conversations.twilio.com/*", () => {
        return HttpResponse.json({ state: "active" });
    }),
    http.patch("https://conversations.twilio.com/*", () => {
        return HttpResponse.json({ state: "closed" });
    }),
];
