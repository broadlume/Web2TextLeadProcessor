import ky from "ky";
import type { MessageInstance } from "twilio/lib/rest/conversations/v1/conversation/message";
import type { Jsonify } from "type-fest";
import { logger } from "../../logger";
import type { Web2TextLead } from "../../../web2text/types";

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
	lead: RLMCreateLeadRequest,
	apiKey: string,
): Promise<RLMLeadResponse> {
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
	RLMLeadUUID: string,
	web2TextLead: Web2TextLead,
	twilioMessage: Jsonify<MessageInstance>,
): Promise<RLMLeadResponse> {
	let senderName =
		twilioMessage.author === web2TextLead.Lead.PhoneNumber
			? web2TextLead.Lead.Name
			: "Dealer";
	const attributes = JSON.parse(twilioMessage.attributes ?? "{}");
	if (attributes["SystemMessage"] === true) {
		senderName = "System";
	}
	let messageBody = twilioMessage.body ?? "";
	messageBody += (twilioMessage.media ?? [])
		.map((m) => `\n[MEDIA ATTACHMENT - ${m.filename}]`)
		.join("");
	const note: RLMAttachNoteRequest = {
		lead_uuid: RLMLeadUUID,
		sender_name: senderName,
		sender_phone: twilioMessage.author,
		date: twilioMessage.dateCreated,
		message: `\n\n${messageBody}\n`,
	};

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
			.warn(
				`Failed to post note to RLM for Twilio message SID ${twilioMessage.sid}`,
			);
		logger.child({ label: "RLMLeadsAPI:AttachNoteToLead" }).error(e);
		throw e;
	}
}
