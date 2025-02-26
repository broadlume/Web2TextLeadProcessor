import { logger as _logger } from "common";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

export const ENV_FILE_SCHEMA = z
	.object({
		AWS_REGION: z.string().min(1, "AWS Region is required"),
		INTERNAL_API_TOKEN: z
			.string()
			.uuid("Internal API Token must be a valid UUID")
			.optional(),
		RESTATE_ADMIN_URL: z.string().url("Restate Admin URL must be a valid URL"),
		LOCAL_DYNAMODB_URL: z
			.string()
			.url("Local DynamoDB URL must be a valid URL")
			.optional(),
		COPILOT_ENVIRONMENT_NAME: z
			.enum(["development", "production"], {
				errorMap: () => ({
					message:
						"Copilot Environment must be either 'development' or 'production'",
				}),
			})
			.optional(),
		NODE_ENV: z.string().optional(),
		ACTON_BASE_URL: z.string().url("ActOn Base URL must be a valid URL"),
		ACTON_CLIENT_ID: z.string().min(1, "ActOn Client ID is required"),
		ACTON_CLIENT_SECRET: z.string().min(1, "ActOn Client Secret is required"),
		ACTON_USERNAME: z.string().min(1, "ActOn Username is required"),
		ACTON_PASSWORD: z.string().min(1, "ActOn Password is required"),
		FF_API_URL: z.string().url("FF API URL must be a valid URL"),
		FF_API_USERNAME: z.string().min(1, "FF API Username is required"),
		FF_API_PASSWORD: z.string().min(1, "FF API Password is required"),
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
