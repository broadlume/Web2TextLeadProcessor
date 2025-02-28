import { Into } from "common/external";
import type { DHQStoreInquiryAPI } from "common/external/dhq";
import type { NexusStoresAPI } from "common/external/nexus";
import type { MessageInstance } from "twilio/lib/rest/conversations/v1/conversation/message";
import type { Jsonify } from "type-fest";
import type { SubmittedLeadState, Web2TextLead } from "../../types";

export class Web2TextMessageIntoDhqComment extends Into<DHQStoreInquiryAPI.AddCommentRequest> {
	private twilioMessage: Jsonify<MessageInstance>;
	private web2TextLead: SubmittedLeadState<Web2TextLead>;
	constructor(
		web2TextLead: SubmittedLeadState<Web2TextLead>,
		twilioMessage: Jsonify<MessageInstance>,
	) {
		super();
		this.twilioMessage = twilioMessage;
		this.web2TextLead = web2TextLead;
	}
	into(): DHQStoreInquiryAPI.AddCommentRequest {
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
			.map((m) => `\n[MEDIA ATTACHMENT - ${m.filename}]`)
			.join("");
		const dhqComment: DHQStoreInquiryAPI.AddCommentRequest = {
			comment: {
				// Double any newline because DHQ doesn't render them correctly
				body: `**| ${senderName}**: ${messageBody.replaceAll("\n", "\n\n")}`,
				author_id: 262,
			},
		};
		return dhqComment;
	}
}

export class Web2TextLeadIntoDHQStoreInquiry extends Into<DHQStoreInquiryAPI.StoreInquiryRequest> {
	private web2TextLead: SubmittedLeadState<Web2TextLead>;
	private storeInfo: NexusStoresAPI.RetailerStore;
	constructor(
		web2TextLead: SubmittedLeadState<Web2TextLead>,
		storeInfo: NexusStoresAPI.RetailerStore,
	) {
		super();
		this.web2TextLead = web2TextLead;
		this.storeInfo = storeInfo;
	}
	into(): DHQStoreInquiryAPI.StoreInquiryRequest {
		const dhqLead: DHQStoreInquiryAPI.StoreInquiryRequest = {
			occurred_at: this.web2TextLead.DateSubmitted,
			store_address: this.storeInfo.street_address,
			universal_store_id: this.storeInfo.universal_id,
			traffic: {
				source: "Other",
				medium: "Referral",
				campaign: "Web2Text",
			},
			inquiry: {
				contact_method: "cys_inquiry",
				email: `poweredbytextdirect+${this.web2TextLead.Lead.PhoneNumber.replace(/\D+/g, "")}@broadlume.com`,
				external_id: this.web2TextLead.LeadId,
				message: this.web2TextLead.Lead.CustomerMessage,
				name: this.web2TextLead.Lead.Name,
				page_url: this.web2TextLead.Lead.PageUrl,
				phone_number: this.web2TextLead.Lead.PhoneNumber,
				preferred_location: this.storeInfo.street_address,
				product: this.web2TextLead.Lead.AssociatedProductInfo
					? {
							brand: this.web2TextLead.Lead.AssociatedProductInfo.Brand,
							name: this.web2TextLead.Lead.AssociatedProductInfo.Product,
							color: this.web2TextLead.Lead.AssociatedProductInfo.Variant,
						}
					: undefined,
			},
			custom_fields: [
				{
					name: "Web2TextLeadID",
					value: this.web2TextLead.LeadId,
					displayable: false,
				},
				{
					name: "Twilio Conversation SID",
					value:
						this.web2TextLead.Integrations?.["Twilio"]?.Data?.ConversationSID ??
						"null",
					displayable: false,
				},
			],
		};
		if (dhqLead.inquiry.preferred_location == null) {
			delete dhqLead.inquiry.preferred_location;
		}
		return dhqLead;
	}
}
