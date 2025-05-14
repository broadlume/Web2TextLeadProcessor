import { logger as _logger } from "common";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

export const ENV_FILE_SCHEMA = z
	.object({
		/** Twilio Account SID for authentication */
		TWILIO_ACCOUNT_SID: z.string().min(1, "Twilio Account SID is required"),
		/** Twilio Auth Token for authentication */
		TWILIO_AUTH_TOKEN: z.string().min(1, "Twilio Auth Token is required"),
		/** Twilio API Key SID for API access */
		TWILIO_API_SID: z.string().min(1, "Twilio API SID is required"),
		/** Twilio API Secret for API access */
		TWILIO_API_SECRET: z.string().min(1, "Twilio API Secret is required"),
		/** AWS Region */
		AWS_REGION: z.string().min(1, "AWS Region is required"),
		/** UUID token for internal service authentication. Auto-generated if not specified */
		INTERNAL_API_TOKEN: z
			.string()
			.uuid("Internal API Token must be a valid UUID")
			.optional(),
		/** Old Nexus API base URL */
		NEXUS_API_URL: z.string().url("Nexus API URL must be a valid URL"),
		/** New AWS Nexus API base URL */
		NEXUS_AWS_API_URL: z.string().url("Nexus AWS API URL must be a valid URL"),
		/** AWS Secret Manager secret that has the AWS Cognito auth information for Nexus API */
		NEXUS_AWS_API_SECRET_NAME: z
			.string()
			.min(1, "Nexus AWS API Secret Name is required"),
		/** Username for Nexus API authentication */
		NEXUS_API_USERNAME: z.string().min(1, "Nexus API Username is required"),
		/** Password for Nexus API authentication */
		NEXUS_API_PASSWORD: z.string().min(1, "Nexus API Password is required"),
		/** Retail Lead Management API base URL */
		RLM_API_URL: z.string().url("RLM API URL must be a valid URL"),
		RLM_GOD_API_KEY: z.string().min(1, "RLM God API key is required"),
		RLM_GOD_EMAIL: z.string().min(1, "RLM God email is required"),
		/** Restate admin interface URL */
		RESTATE_ADMIN_URL: z.string().url("Restate Admin URL must be a valid URL"),
		/** Local DynamoDB instance URL for development */
		LOCAL_DYNAMODB_URL: z
			.string()
			.url("Local DynamoDB URL must be a valid URL")
			.optional(),
		/** Twilio Proxy service URL */
		TWILIO_PROXY_URL: z.string().url("Twilio Proxy URL must be a valid URL"),
		/** Username for Twilio Proxy authentication */
		TWILIO_PROXY_USER: z.string().min(1, "Twilio Proxy User is required"),
		/** Password for Twilio Proxy authentication */
		TWILIO_PROXY_PASS: z.string().min(1, "Twilio Proxy Password is required"),
		/** DealerHQ API base URL */
		DHQ_API_URL: z.string().url("DealerHQ API URL must be a valid URL"),
		/** DealerHQ API authentication key */
		DHQ_API_KEY: z.string().min(1, "DealerHQ API Key is required"),
		/** Copilot environment name */
		DEPLOYMENT_ENV: z
			.enum(["development", "production"], {
				errorMap: () => ({
					message:
						"Deployment environment must be either 'development' or 'production'",
				}),
			})
			.optional(),
		/** Node environment (development/production) */
		NODE_ENV: z.string().optional(),
		/** Twilio messaginging service SID to use */
		TWILIO_MESSAGING_SERVICE_SID: z
			.string()
			.min(1, "Twilio Messaging Service SID is required"),
		/** Nexus Auth AWS access key id for web2text IAM user */
		NEXUS_AUTH_AWS_ACCESS_KEY_ID: z
			.string()
			.min(1, "Nexus Auth AWS Access Key ID is required"),
		/** Nexus Auth AWS secret access key for web2text IAM user */
		NEXUS_AUTH_AWS_SECRET_ACCESS_KEY: z
			.string()
			.min(1, "Nexus Auth AWS Secret Access Key is required"),
		/** Nexus Auth AWS secret region */
		NEXUS_AUTH_AWS_REGION: z
			.string()
			.min(1, "Nexus Auth AWS secret region is required"),
		/** Public Restate ingress URL */
		PUBLIC_RESTATE_INGRESS_URL: z
			.string()
			.url("Public Restate Ingress URL must be a valid URL")
			.optional(),
		/** Botpress API token */
		BOTPRESS_API_TOKEN: z.string().min(1, "Botpress Personal Access Token is required"),
		/** Botpress Bot ID */
		BOTPRESS_BOT_ID: z.string().min(1, "Botpress Bot ID is required"),
		/** Botpress workspace id */
		BOTPRESS_WORKSPACE_ID: z.string().min(1, "Botpress Workspace ID is required"),
	})
	.passthrough();

export type EnvConfig = z.infer<typeof ENV_FILE_SCHEMA>;

export function VerifyEnvVariables(): boolean {
	const parsed = ENV_FILE_SCHEMA.safeParse(process.env);
	if (parsed.success) return true;
	const formatted = fromZodError(parsed.error);
	_logger.error(`Error verifying env variables:\n${formatted.message}`, {
		_meta: 1,
		Error: formatted,
	});
	return false;
}
