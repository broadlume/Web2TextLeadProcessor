type ValidEnvironment = "test" | "development" | "production";
/**
 * Determines the current running environment of the application.
 * 
 * @returns {Object} An object containing environment information.
 * @property {boolean} local - Indicates whether the application is running locally.
 * @property {ValidEnvironment} environment - The current environment.
 */
export function GetRunningEnvironment(): {
	local: boolean;
	environment: ValidEnvironment;
} {
	return {
		local: process.env.COPILOT_ENVIRONMENT_NAME != null,
		environment: (process.env.COPILOT_ENVIRONMENT_NAME ??
			process.env.NODE_ENV ?? "development") as ValidEnvironment,
	};
}

export function isProductionAndDeployed(): boolean {
    const env = GetRunningEnvironment();
    return env.environment === "production" && env.local === false;
}