export const ENV_PREFIX = (() => {
	if (process.env.NODE_ENV === "test") {
		return "TEST";
	}
	if (process.env["COPILOT_ENVIRONMENT_NAME"] === "production") {
		return "PROD";
	}
	return "DEV";
})();
