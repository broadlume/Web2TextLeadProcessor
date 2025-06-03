export const TWILIO_PROXY_AUTHORIZATION_HEADERS = () => {
    const headers = new Headers();
    const authorization = Buffer.from(`${process.env.TWILIO_PROXY_USER}:${process.env.TWILIO_PROXY_PASS}`).toString(
        "base64",
    );
    headers.set("Authorization", `Basic ${authorization}`);
    headers.set("Content-Type", "application/json");
    return headers;
};
export * as TwilioConversationHelpers from "./TwilioConversationHelpers";
export * as TwilioLookupAPI from "./TwilioLookupApi";
export * as TwilioProxyAPI from "./TwilioProxyAPI";
