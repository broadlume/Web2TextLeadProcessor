export * as RLMLeadsAPI from "./RLMLeadsAPI";
export * as RLMLocationsAPI from "./RLMLocationsAPI";
export const RLM_GOD_AUTHORIZATION_HEADERS = () => {
	const headers = new Headers();
	headers.set("X-Api-Key", process.env.RLM_GOD_API_KEY!);
	headers.set("X-User-Email", process.env.RLM_GOD_EMAIL!);
	return headers;
};
