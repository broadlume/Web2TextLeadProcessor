import type { Twilio } from "twilio";
import type { EnvConfig } from "./env";

declare global {
	namespace NodeJS {
		interface ProcessEnv extends EnvConfig {}
	}

	/** Global Twilio client instance */
	var TWILIO_CLIENT: Twilio;
}

