import type * as restate from "@restatedev/restate-sdk";
import type { TypedState } from "@restatedev/restate-sdk/dist/cjs/src/context";
import type { Twilio } from "twilio";
import { LeadState } from "./restate/common";
declare global {
	namespace NodeJS {
		interface ProcessEnv {
			TWILIO_ACCOUNT_SID: string;
			TWILIO_AUTH_TOKEN: string;
			TWILIO_API_SID: string;
			TWILIO_API_SECRET: string;
			INTERNAL_API_TOKEN?: string;
			NEXUS_API_URL: string;
			NEXUS_AWS_API_URL: string;
			NEXUS_API_USERNAME: string;
			NEXUS_API_PASSWORD: string;
			RLM_API_URL: string;
			RESTATE_ADMIN_URL: string;
			LOCAL_DYNAMODB_URL?: string;
			TWILIO_PROXY_URL: string;
			TWILIO_PROXY_USER: string;
			TWILIO_PROXY_PASS: string;
			DHQ_API_URL: string;
			DHQ_API_KEY: string;
			COPILOT_ENVIRONMENT_NAME: "development" | "production" | undefined;
			NODE_ENV: string;
			TWILIO_MESSAGING_SERVICE_SID: string;
			VIZ_AWS_ACCESS_KEY_ID: string;
			VIZ_AWS_SECRET_ACCESS_KEY: string;
		}
	}
	var TWILIO_CLIENT: Twilio;
}
