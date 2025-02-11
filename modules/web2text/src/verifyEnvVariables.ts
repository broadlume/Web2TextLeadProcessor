import { logger as _logger } from "common";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

export const ENV_FILE_SCHEMA = z
	.object({
		TWILIO_ACCOUNT_SID: z.string().min(1, "Twilio Account SID is required"),
		TWILIO_AUTH_TOKEN: z.string().min(1, "Twilio Auth Token is required"),
		TWILIO_API_SID: z.string().min(1, "Twilio API SID is required"),
		TWILIO_API_SECRET: z.string().min(1, "Twilio API Secret is required"),
		AWS_REGION: z.string().min(1, "AWS Region is required"),
		INTERNAL_API_TOKEN: z
			.string()
			.uuid("Internal API Token must be a valid UUID")
			.optional(),
		NEXUS_API_URL: z.string().url("Nexus API URL must be a valid URL"),
		NEXUS_AWS_API_URL: z.string().url("Nexus AWS API URL must be a valid URL"),
		NEXUS_AWS_API_SECRET_NAME: z
			.string()
			.min(1, "Nexus AWS API Secret Name is required"),
		NEXUS_API_USERNAME: z.string().min(1, "Nexus API Username is required"),
		NEXUS_API_PASSWORD: z.string().min(1, "Nexus API Password is required"),
		RLM_API_URL: z.string().url("RLM API URL must be a valid URL"),
		RESTATE_ADMIN_URL: z.string().url("Restate Admin URL must be a valid URL"),
		LOCAL_DYNAMODB_URL: z
			.string()
			.url("Local DynamoDB URL must be a valid URL")
			.optional(),
		TWILIO_PROXY_URL: z.string().url("Twilio Proxy URL must be a valid URL"),
		TWILIO_PROXY_USER: z.string().min(1, "Twilio Proxy User is required"),
		TWILIO_PROXY_PASS: z.string().min(1, "Twilio Proxy Password is required"),
		DHQ_API_URL: z.string().url("DealerHQ API URL must be a valid URL"),
		DHQ_API_KEY: z.string().min(1, "DealerHQ API Key is required"),
		COPILOT_ENVIRONMENT_NAME: z
			.enum(["development", "production"], {
				errorMap: () => ({
					message:
						"Copilot Environment must be either 'development' or 'production'",
				}),
			})
			.optional(),
		NODE_ENV: z.string().optional(),
		TWILIO_MESSAGING_SERVICE_SID: z
			.string()
			.min(1, "Twilio Messaging Service SID is required"),
		NEXUS_AUTH_AWS_ACCESS_KEY_ID: z
			.string()
			.min(1, "Nexus Auth AWS Access Key ID is required"),
		NEXUS_AUTH_AWS_SECRET_ACCESS_KEY: z
			.string()
			.min(1, "Nexus Auth AWS Secret Access Key is required"),
		NEXUS_AUTH_AWS_REGION: z
			.string()
			.min(1, "Nexus Auth AWS secret region is required"),
	})
	.passthrough();

export type EnvConfig = z.infer<typeof ENV_FILE_SCHEMA>;

export function VerifyEnvVariables() {
	const parsed = ENV_FILE_SCHEMA.safeParse(process.env);
	if (parsed.success) return;
	const formatted = fromZodError(parsed.error);
	_logger.error(`Error verifying env variables:\n${formatted.message}`, {
		_meta: 1,
		Error: formatted,
	});
}
