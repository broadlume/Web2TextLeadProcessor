import ky from "ky";
import { logger } from "../../logger";
import type { z } from "zod";
import { FF_AUTHORIZATION_HEADERS } from ".";
import { Into } from "..";
import type { WebFormLeadSchema } from "../../../../acton/src/types";

export type FfLeadRequest = z.infer<typeof WebFormLeadSchema>;
export type FfLeadResponse = {}

export async function CreateLead(request: Into<FfLeadRequest> | FfLeadRequest) {
	const ffLead = request instanceof Into ? request.into() : request;
	const ffUrl = new URL(process.env.FF_API_URL);
	ffUrl.pathname += "/external/postactonformdata";

	const headers = FF_AUTHORIZATION_HEADERS();
	try {
		const response = await ky
			.post(ffUrl.toString(), {
				headers: headers,
				json: ffLead,
			})
			.json();
		return response;
	} catch (e) {
		logger
			.child({ label: "DHQStoreInquiryAPI:SubmitStoreInquiry" })
			.warn("Failed to post lead to DHQ", { _meta: 1, FfLead: ffLead });
		logger.child({ label: "DHQStoreInquiryAPI:SubmitStoreInquiry" }).error(e);
		throw e;
	}
}
