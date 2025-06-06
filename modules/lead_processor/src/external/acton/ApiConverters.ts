import { Into } from "common/external";
import type { FfWebAPI } from "common/external/floorforce";
import type { ActOnLead } from "#lead/acton";

export class ActonLeadIntoFf extends Into<FfWebAPI.FfLeadRequest> {
    constructor(private actonLead: ActOnLead) {
        super();
        this.actonLead = actonLead;
    }
    into(): FfWebAPI.FfLeadRequest {
        const ffLead: FfWebAPI.FfLeadRequest = {
            "First Name": this.actonLead["First Name"],
            "Last Name": this.actonLead["Last Name"],
            "E-mail Address": this.actonLead["E-mail Address"],
            "Home Phone": this.actonLead["Home Phone"],
            // ao_a: this.webFormLead.ao_a,
            // ao_f: this.webFormLead.ao_f,
            // ao_d: this.webFormLead.ao_d,
            // ao_p: this.webFormLead.ao_p,
            // ao_jstzo: this.webFormLead.ao_jstzo,
            // ao_bot: this.webFormLead.ao_bot,
            "Home Postal Code": this.actonLead["Home Postal Code"],
            preferred_location: this.actonLead.preferred_location,
            dealername: this.actonLead.dealername,
            dealerlogo: this.actonLead.dealerlogo,
            dealeraddr: this.actonLead.dealeraddr,
            dealerphone: this.actonLead.dealerphone,
            omnifycampaign: this.actonLead.omnifycampaign,
            formname: this.actonLead.formname,
            promotion: this.actonLead.promotion,
            source: this.actonLead.source,
            foreignid: this.actonLead.foreignid,
            dealerzip: this.actonLead.dealerzip,
            formcategory: this.actonLead.formcategory,
            sourcedetail: this.actonLead.sourcedetail,
            sourceurl: this.actonLead.sourceurl,
            dealercity: this.actonLead.dealercity,
            dealerstate: this.actonLead.dealerstate,
            notes: this.actonLead.notes,
            comments: this.actonLead.comments,
            optin: this.actonLead.optin,
        };

        return ffLead;
    }
}
