import type { Web2TextLead } from "../../types";

type RLMLeadResponse = {
    result: "Success";
    lead_id: number;
} | {
    result: "Error" | "No data";
    messages?: string;
}

interface RLMCreateLeadRequest {
    lead: {
        location_name: string;
        divison_name: string;
        source_name: string;
        channel_name?: string;
        company_name?: string;
        first_name?: string;
        last_name?: string;
        title?:string;
        email?:string;
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
        products_interested_in?: string[]
        opt_in?: boolean;
        promo_type?: string;
        note?: string;
    }
}

export function RLM_CreateLeadRequest(lead: Web2TextLead): RLMCreateLeadRequest {
    const rlmLead: RLMCreateLeadRequest["lead"] = {
        location_name: "Per Pipeline configuration",
        divison_name: "Per Pipeline configuration",
        source_name: "Web2Text"
    };
    const [first_name, ...last_name] = lead.Lead.Name.split(/\s+/)
    rlmLead.first_name =  first_name;
    rlmLead.last_name = last_name.join(" ");
    rlmLead.phone = lead.Lead.PhoneNumber;
    rlmLead.mobile_phone = lead.Lead.PhoneNumber;
    rlmLead.website = new URL(lead.Lead.PageUrl).hostname;
    rlmLead.note = `--------------------
    Web2Text Lead Information
    --------------------
    PageUrl: ${lead.Lead.PageUrl}
    Customer Name: ${lead.Lead.Name}
    Customer Phone: ${lead.Lead.PhoneNumber}
    Date Submitted: ${new Date(lead.DateSubmitted).toUTCString()}
    Preferred Method of Contact: ${lead.Lead.PreferredMethodOfContact}
    `;

    if (lead.Lead.AssociatedProductInfo) {
        rlmLead.note = `${rlmLead.note}
        Customer was looking at ${lead.Lead.AssociatedProductInfo.Product} by ${lead.Lead.AssociatedProductInfo.Brand} | ${lead.Lead.AssociatedProductInfo.Variant}`
    }
    rlmLead.note = `${rlmLead.note}
    --------------------
    Customer Message:
    
    ${lead.Lead.CustomerMessage}`;
    return {
        lead: rlmLead
    };
}


export async function RLM_CreateLead(web2TextLeadId: string, lead: RLMCreateLeadRequest, apiKey: string): Promise<RLMLeadResponse> {
    const rlmURL = new URL(process.env.RLM_API_URL);
    rlmURL.pathname += `api/${apiKey}/leads`;

    const headers = new Headers();
    headers.set("content-type","application/json");
    const response = await fetch(rlmURL.toString(),{
        method: "POST",
        headers:headers,
        body: JSON.stringify(lead)
    });

    if (response.ok) {
        const responseBody = await response.json();
        return responseBody as RLMLeadResponse;
    }
    const error = await response.text().catch(_ => response.status);
    throw new Error(`Failed to post lead '${web2TextLeadId}' to RLM`, {cause: {status: response.status, error}});
}