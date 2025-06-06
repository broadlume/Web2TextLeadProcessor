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
    if (process.env.NODE_ENV === "test") {
        return {
            local: true,
            environment: "test",
        };
    }
    return {
        local: process.env.DEPLOYMENT_ENV == null,
        environment: (process.env.DEPLOYMENT_ENV ?? process.env.DEPLOYMENT_ENV ?? "development") as ValidEnvironment,
    };
}

export function isProductionAndDeployed(): boolean {
    const env = GetRunningEnvironment();
    return env.environment === "production" && env.local === false;
}
export function isDeployed(): boolean {
    return GetRunningEnvironment().local === false;
}

export const ENV_PREFIX = (() => {
    const env = GetRunningEnvironment();
    if (env.environment === "test") {
        return "TEST";
    }
    if (env.environment === "production") {
        return "PROD";
    }
    return "DEV";
})();
