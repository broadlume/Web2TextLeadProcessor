import { Into } from "common/external";
import type { RLMLeadsAPI } from "common/external/rlm";
import type { MessageInstance } from "twilio/lib/rest/conversations/v1/conversation/message";
import type { Jsonify } from "type-fest";
import type { SubmittedLeadState, Web2TextLead } from "../../types";

export class Web2TextMessageIntoRLMNote extends Into<RLMLeadsAPI.RLMAttachNoteRequest> {
	private twilioMessage: Jsonify<MessageInstance>;
	private web2TextLead: SubmittedLeadState<Web2TextLead>;
	private rlmLeadUUID: string;
	constructor(
		rlmLeadUUID: string,
		web2TextLead: SubmittedLeadState<Web2TextLead>,
		twilioMessage: Jsonify<MessageInstance>,
	) {
		super();
		this.twilioMessage = twilioMessage;
		this.web2TextLead = web2TextLead;
		this.rlmLeadUUID = rlmLeadUUID;
	}
	into(): RLMLeadsAPI.RLMAttachNoteRequest {
		let senderName =
			this.twilioMessage.author === this.web2TextLead.Lead.PhoneNumber
				? this.web2TextLead.Lead.Name
				: "Dealer";
		const attributes = JSON.parse(this.twilioMessage.attributes ?? "{}");
		if (attributes["SystemMessage"] === true) {
			senderName = "System";
		}
		let messageBody = this.twilioMessage.body ?? "";
		messageBody += (this.twilioMessage.media ?? [])
			.map((m) => `\n[MEDIA ATTACHMENT - ${(m as any).filename as string}]`)
			.join("");
		const note: RLMLeadsAPI.RLMAttachNoteRequest = {
			lead_uuid: this.rlmLeadUUID,
			sender_name: senderName,
			sender_phone: this.twilioMessage.author,
			date: this.twilioMessage.dateCreated,
			message: `\n\n${messageBody}\n`,
		};
		return note;
	}
}

export class Web2TextLeadIntoRLMLead extends Into<RLMLeadsAPI.RLMCreateLeadRequest> {
	private web2TextLead: SubmittedLeadState<Web2TextLead>;
	/**
	 * The name of the location - RLM uses this to associated the lead with the correct location
	 *
	 * Defaults to the default location for the retailer in RLM
	 *
	 * Usually follows the format: "City, State Abbreviation"
	 * @example "Gastonia, NC"
	 * @default "Per Pipeline configuration"
	 */
	private rlmLocationName: string;
	constructor(
		web2TextLead: SubmittedLeadState<Web2TextLead>,
		rlmLocationName: string = "Per Pipeline configuration",
	) {
		super();
		this.web2TextLead = web2TextLead;
		this.rlmLocationName = rlmLocationName;
	}
	private static formatLeadIntoMessage(lead: SubmittedLeadState<Web2TextLead>): string {
		let message = `--------------------
        Web2Text Lead Information
        --------------------
        PageUrl: ${lead.Lead.PageUrl}
        Customer Name: ${lead.Lead.Name}
        Customer Phone: ${lead.Lead.PhoneNumber}
        Date Submitted: ${new Date(lead.DateSubmitted).toUTCString()}
        Preferred Method of Contact: ${lead.Lead.PreferredMethodOfContact}
        `;

		if (lead.Lead.AssociatedProductInfo) {
			message = `${message}
            Customer was looking at ${lead.Lead.AssociatedProductInfo.Product} by ${lead.Lead.AssociatedProductInfo.Brand} | ${lead.Lead.AssociatedProductInfo.Variant}`;
		}
		message = `${message}
        --------------------
        Customer Message:
        
        ${lead.Lead.CustomerMessage}`;
		return message;
	}
	into(): RLMLeadsAPI.RLMCreateLeadRequest {
		const rlmLead: RLMLeadsAPI.RLMCreateLeadRequest["lead"] = {
			location_name: this.rlmLocationName,
			divison_name: "Per Pipeline configuration",
			source_name: "Web2Text",
		};
		const [first_name, ...last_name] = this.web2TextLead.Lead.Name.split(/\s+/);
		rlmLead.first_name = first_name;
		rlmLead.last_name = last_name.join(" ");
		rlmLead.phone = this.web2TextLead.Lead.PhoneNumber;
		rlmLead.mobile_phone = this.web2TextLead.Lead.PhoneNumber;
		rlmLead.website = new URL(this.web2TextLead.Lead.PageUrl).hostname;
		rlmLead.note = Web2TextLeadIntoRLMLead.formatLeadIntoMessage(
			this.web2TextLead,
		);
		return {
			lead: rlmLead,
		};
	}
}
