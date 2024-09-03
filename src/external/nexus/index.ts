export const NEXUS_AUTHORIZATION_HEADERS = () => {
	const headers = new Headers();
	const authorization = Buffer.from(
		`${process.env.NEXUS_API_USERNAME}:${process.env.NEXUS_API_PASSWORD}`,
	).toString("base64");
	headers.set("Authorization", `Basic ${authorization}`);
	return headers;
};

export * as RetailerAPI from "./RetailerAPI";
export * as StoresAPI from "./StoresAPI";