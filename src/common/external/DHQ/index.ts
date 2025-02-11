export * as DHQStoreInquiryAPI from "./DHQStoreInquiryAPI";
export { DHQIntegration as DHQIntergration } from "../../../web2text/external/DHQ/DHQIntegration";
export const DHQ_AUTHORIZATION_HEADERS = () => {
	const headers = new Headers();
	const authorization = process.env.DHQ_API_KEY;
	headers.set("Authorization", `Bearer ${authorization}`);
	return headers;
};
