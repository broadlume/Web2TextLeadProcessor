import ky from "ky";
import z from "zod";
import { FF_HEADERS } from ".";
import { Into } from "..";
import { logger } from "../../logger";

const FFLead = z.record(z.string(), z.any());
export type FfLeadRequest = z.infer<typeof FFLead>;
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
	const headers = FF_HEADERS();
	//FF WEB API expects the data to be urlencoded
	const urlEncodedData = new URLSearchParams(
		ffLead as Record<string, string>,
	).toString();
	try {
		const response = await ky.post(ffUrl.toString(), {
			headers: headers,
			body: urlEncodedData,
		});

		if (response?.status !== 200)
			return {
				status: "failure",
				message: "Failed to create lead",
			};

		return {
			status: "success",
			message: "Lead created successfully",
		};
	} catch (e) {
		logger
			.child({ label: "FfWebAPI.CreateLead" })
			.warn("Failed to post lead to FfWebAPI", { _meta: 1, FfLead: ffLead });
		logger.child({ label: "FfWebAPI.CreateLead" }).error(e);
		throw e;
	}
}
