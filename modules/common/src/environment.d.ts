import type { Twilio } from "twilio";
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
			/** Twilio messaginging service SID to use */
			TWILIO_MESSAGING_SERVICE_SID: string;
			/** UUID token for internal service authentication. Auto-generated if not specified */
			INTERNAL_API_TOKEN?: string;
			/** Old Nexus API base URL */
			NEXUS_API_URL: string;
			/** New AWS Nexus API base URL */
			NEXUS_AWS_API_URL: string;
			/** AWS Secret Manager secret that has the AWS Cognito auth information for Nexus API */
			NEXUS_AWS_API_SECRET_NAME: string;
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
			/** Nexus Auth AWS access key id for web2text IAM user */
			NEXUS_AUTH_AWS_ACCESS_KEY_ID: string;
			/** Nexus Auth AWS secret access key for web2text IAM user */
			NEXUS_AUTH_AWS_SECRET_ACCESS_KEY: string;
			/** Nexus Auth AWS secret region */
			NEXUS_AUTH_AWS_REGION: string;
			/** ActOn API base URL */
			ACTON_BASE_URL: string;
			ACTON_CLIENT_ID: string;
			ACTON_CLIENT_SECRET: string;
			ACTON_AUTH_TOKEN: string;
			/** FF Web API base URL */
			FF_API_URL: string;
			FF_API_USERNAME: string;
			FF_API_PASSWORD: string;
		}
	}
	/** Global Twilio client instance */
	var TWILIO_CLIENT: Twilio;
}
