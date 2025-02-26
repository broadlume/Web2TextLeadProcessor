import ky from "ky";
import type { z } from "zod";
import { FF_AUTHORIZATION_HEADERS } from ".";
import { Into } from "..";
import type { WebFormLeadSchema } from "../../../../acton/src/types";
import { logger } from "../../logger";

export type FfLeadRequest = z.infer<typeof WebFormLeadSchema>;
export type FfLeadResponse = {
	status: string;
	message: string;
};

export async function CreateLead(
	request: Into<FfLeadRequest> | FfLeadRequest,
): Promise<FfLeadResponse> {
	const ffLead = request instanceof Into ? request.into() : request;
	const ffUrl = new URL(process.env.FF_API_URL);
	ffUrl.pathname += "external/postactonformdata";
	const headers = FF_AUTHORIZATION_HEADERS();

	//FF WEB API expects the data to be urlencoded
	const urlEncodedData = new URLSearchParams(
		ffLead as Record<string, string>,
	).toString();
	try {
		const response = await ky.post(ffUrl.toString(), {
			headers: headers,
			body: urlEncodedData,
		});

		if (response?.ok)
			return {
				status: "success",
				message: "Lead created successfully",
			};

		return {
			status: "failure",
			message: "Failed to create lead",
		};
	} catch (e) {
		logger
			.child({ label: "FfWebAPI.CreateLead" })
			.warn("Failed to post lead to FfWebAPI", { _meta: 1, FfLead: ffLead });
		logger.child({ label: "FfWebAPI.CreateLead" }).error(e);
		throw e;
	}
}
