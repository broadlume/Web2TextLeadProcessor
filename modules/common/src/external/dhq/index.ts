export * as DHQStoreInquiryAPI from "./DHQStoreInquiryAPI";
export const DHQ_AUTHORIZATION_HEADERS = () => {
	const headers = new Headers();
	const authorization = process.env.DHQ_API_KEY;
	headers.set("Authorization", `Bearer ${authorization}`);
	return headers;
};
