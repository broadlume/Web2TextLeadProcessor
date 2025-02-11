export const NEXUS_AUTHORIZATION_HEADERS = () => {
	const headers = new Headers();
	const authorization = Buffer.from(
		`${process.env.NEXUS_API_USERNAME}:${process.env.NEXUS_API_PASSWORD}`,
	).toString("base64");
	headers.set("Authorization", `Basic ${authorization}`);
	return headers;
};

export * as NexusRetailerAPI from "./NexusRetailerAPI";
export * as NexusStoresAPI from "./NexusStoresAPI";
export * as NexusAWSAuth from "./NexusAWSAuth";
