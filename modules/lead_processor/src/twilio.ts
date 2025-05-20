import Twilio from "twilio";

export const TWILIO_CLIENT = Twilio(
	process.env.TWILIO_ACCOUNT_SID,
	process.env.TWILIO_AUTH_TOKEN,
);
