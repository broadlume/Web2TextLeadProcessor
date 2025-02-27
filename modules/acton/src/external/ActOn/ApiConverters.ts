import { Into } from "common/external";
import type { WebFormLead } from "../../types";
import { FfWebAPI } from "common/external/floorforce";

export class WebFormLeadIntoFf extends Into<FfWebAPI.FfLeadRequest> {
	constructor(private webFormLead: WebFormLead) {
		super();
		this.webFormLead = webFormLead;
	}
	into(): FfWebAPI.FfLeadRequest {
		const ffLead: FfWebAPI.FfLeadRequest = {
			"First Name": this.webFormLead["First Name"],
			"Last Name": this.webFormLead["Last Name"],
			"E-mail Address": this.webFormLead["E-mail Address"],
			"Home Phone": this.webFormLead["Home Phone"],
			// ao_a: this.webFormLead.ao_a,
			// ao_f: this.webFormLead.ao_f,
			// ao_d: this.webFormLead.ao_d,
			// ao_p: this.webFormLead.ao_p,
			// ao_jstzo: this.webFormLead.ao_jstzo,
			// ao_bot: this.webFormLead.ao_bot,
			"Home Postal Code": this.webFormLead["Home Postal Code"],
			preferred_location: this.webFormLead.preferred_location,
			dealername: this.webFormLead.dealername,
			dealerlogo: this.webFormLead.dealerlogo,
			dealeraddr: this.webFormLead.dealeraddr,
			dealerphone: this.webFormLead.dealerphone,
			omnifycampaign: this.webFormLead.omnifycampaign,
			formname: this.webFormLead.formname,
			promotion: this.webFormLead.promotion,
			source: this.webFormLead.source,
			foreignid: this.webFormLead.foreignid,
			dealerzip: this.webFormLead.dealerzip,
			formcategory: this.webFormLead.formcategory,
			sourcedetail: this.webFormLead.sourcedetail,
			sourceurl: this.webFormLead.sourceurl,
			dealercity: this.webFormLead.dealercity,
			dealerstate: this.webFormLead.dealerstate,
			notes: this.webFormLead.notes,
			comments: this.webFormLead.comments,
			optin: this.webFormLead.optin,
		};

		return ffLead;
	}
}
