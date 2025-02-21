export * as ActOnListAPI from "./ActOnListAPI";
export const ACTON_AUTHORIZE_HEADERS = () => {
	const headers = new Headers();
	const authorization = process.env.ACTON_ACCESS_TOKEN;
	headers.set("Authorization", `Bearer ${authorization}`);
	return headers;
};
