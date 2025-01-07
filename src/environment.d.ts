import type * as restate from "@restatedev/restate-sdk";
import type { TypedState } from "@restatedev/restate-sdk/dist/cjs/src/context";
import type { Twilio } from "twilio";
import { LeadState } from "./restate/common";

declare global {
	namespace NodeJS {
		interface ProcessEnv {
			/** Twilio Account SID for authentication */
			TWILIO_ACCOUNT_SID: string;
			/** Twilio Auth Token for authentication */
			TWILIO_AUTH_TOKEN: string;
			/** Twilio API Key SID for API access */
			TWILIO_API_SID: string;
			/** Twilio API Secret for API access */
			TWILIO_API_SECRET: string;
			/** UUID token for internal service authentication. Auto-generated if not specified */
			INTERNAL_API_TOKEN?: string;
			/** Old Nexus API base URL */
			NEXUS_API_URL: string;
			/** New AWS Nexus API base URL */
			NEXUS_AWS_API_URL: string;
			/** Username for Nexus API authentication */
			NEXUS_API_USERNAME: string;
			/** Password for Nexus API authentication */
			NEXUS_API_PASSWORD: string;
			/** Retail Lead Management API base URL */
			RLM_API_URL: string;
			/** Restate admin interface URL */
			RESTATE_ADMIN_URL: string;
			/** Local DynamoDB instance URL for development */
			LOCAL_DYNAMODB_URL?: string;
			/** Twilio Proxy service URL */
			TWILIO_PROXY_URL: string;
			/** Username for Twilio Proxy authentication */
			TWILIO_PROXY_USER: string;
			/** Password for Twilio Proxy authentication */
			TWILIO_PROXY_PASS: string;
			/** DealerHQ API base URL */
			DHQ_API_URL: string;
			/** DealerHQ API authentication key */
			DHQ_API_KEY: string;
			/** Copilot environment name */
			COPILOT_ENVIRONMENT_NAME: "development" | "production" | undefined;
			/** Node environment (development/production) */
			NODE_ENV: string;
			/** Twilio Messaging Service SID */
			TWILIO_MESSAGING_SERVICE_SID: string;
			/** AWS access key ID for Visualizers AWS account */
			VIZ_AWS_ACCESS_KEY_ID: string;
			/** AWS secret access key for Visualizers AWS account */
			VIZ_AWS_SECRET_ACCESS_KEY: string;
		}
	}
	/** Global Twilio client instance */
	var TWILIO_CLIENT: Twilio;
}
