import ky from "ky";
import { Into } from "..";
import { logger } from "../../logger";

export type RLMLeadResponse =
	| {
			result: "Success";
			lead_id: number;
			lead_uuid?: string;
	  }
	| {
			result: "Error" | "No data";
			messages?: string;
	  };

export interface RLMCreateLeadRequest {
	lead: {
		location_name: string;
		divison_name: string;
		source_name: string;
		channel_name?: string;
		company_name?: string;
		first_name?: string;
		last_name?: string;
		title?: string;
		email?: string;
		website?: string;
		phone?: string;
		mobile_phone?: string;
		work_phone?: string;
		work_phone_ext?: string;
		address1?: string;
		address2?: string;
		city?: string;
		state?: string;
		zip?: string;
		deal_name?: string;
		referral_type?: string;
		referral_source?: string;
		products_interested_in?: string[];
		opt_in?: boolean;
		promo_type?: string;
		note?: string;
	};
}

export interface RLMAttachNoteRequest {
	lead_uuid: string;
	sender_phone: string;
	sender_name: string;
	message: string;
	date: string;
}

export async function CreateLead(
	web2TextLeadId: string,
	request: Into<RLMCreateLeadRequest> | RLMCreateLeadRequest,
	apiKey: string,
): Promise<RLMLeadResponse> {
	const lead = request instanceof Into ? request.into() : request;
	const rlmURL = new URL(process.env.RLM_API_URL);
	rlmURL.pathname += `api/${apiKey}/leads`;

	try {
		const response = await ky
			.post(rlmURL.toString(), {
				timeout: 60_000,
				retry: 0,
				json: lead,
			})
			.json<RLMLeadResponse>();
		return response;
	} catch (e) {
		logger
			.child({ label: "RLMLeadsAPI:CreateLead" })
			.warn(`Failed to post lead '${web2TextLeadId}' to RLM`);
		logger.child({ label: "RLMLeadsAPI:CreateLead" }).error(e);
		throw e;
	}
}

export async function AttachNoteToLead(
	request: Into<RLMAttachNoteRequest> | RLMAttachNoteRequest,
): Promise<RLMLeadResponse> {
	const note: RLMAttachNoteRequest =
		request instanceof Into ? request.into() : request;

	const rlmURL = new URL(process.env.RLM_API_URL);
	rlmURL.pathname += "api/note_from_sms";
	try {
		const response = ky
			.post(rlmURL.toString(), {
				timeout: 60_000,
				retry: 0,
				json: note,
			})
			.json<RLMLeadResponse>();
		return response;
	} catch (e) {
		logger
			.child({ label: "RLMLeadsAPI:AttachNoteToLead" })
			.warn("Failed to post note to RLM", { _meta: 1, Note: note });
		logger.child({ label: "RLMLeadsAPI:AttachNoteToLead" }).error(e);
		throw e;
	}
}
