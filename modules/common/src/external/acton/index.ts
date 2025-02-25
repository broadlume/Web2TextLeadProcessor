export * as ActOnListAPI from "./ActOnListAPI";
export const ACTON_AUTHORIZE_HEADERS = () => {
	const headers = new Headers();
	const authorization = process.env.ACTON_AUTH_TOKEN;
	headers.set("Authorization", `Bearer ${authorization}`);
	headers.set("Accept", "application/json");
	return headers;
};
