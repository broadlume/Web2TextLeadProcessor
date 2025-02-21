export * as FfWebAPI from "./FfWebAPI";
export const FF_AUTHORIZATION_HEADERS = () => {
	const headers = new Headers();
	const authorization = process.env.FF_API_KEY;
	headers.set("Authorization", `Bearer ${authorization}`);
	return headers;
};
