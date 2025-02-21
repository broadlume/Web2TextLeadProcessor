import ky from "ky";
import type { z } from "zod";
import { ACTON_AUTHORIZE_HEADERS } from ".";
import { Into } from "..";
import type { WebFormLeadSchema } from "../../../../acton/src/types";
import { logger } from "../../logger";

type ActOnRequest = z.infer<typeof WebFormLeadSchema>;
export interface ActOnResponse {
	status: string;
	message: string;
	id: string;
	contact_id: string;
}

export async function CreateContactAPI(
	listId: string,
	request: Into<ActOnRequest> | ActOnRequest,
) {
	const actOnLead = request instanceof Into ? request.into() : request;
	const actonUrl = new URL(process.env.ACTON_API_URL);
	actonUrl.pathname += `/api/1/lists/${listId}/record`;

	const headers = ACTON_AUTHORIZE_HEADERS();
	try {
		const response = await ky
			.post(actonUrl.toString(), {
				headers: headers,
				json: actOnLead,
			})
			.json<ActOnResponse>();
		return response;
	} catch (e) {
		logger
			.child({ label: "ActOnListAPI:CreateContactAPI" })
			.warn("Failed to post lead to ActOn", { _meta: 1, DHQLead: actOnLead });
		logger.child({ label: "ActOnListAPI:CreateContactAPI" }).error(e);
		throw e;
	}
}
