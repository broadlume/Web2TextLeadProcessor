import type { Web2TextLead } from "../../types";

export function SystemGreetingMessage(dealerName: string): string {
	return `This messaging conversation is being facilitated by Broadlume, a flooring software company. We have connected you with ${dealerName}. Please text STOP to opt out of communication`
}
export function DealerGreetMessage(lead: Web2TextLead, locationName: string): string {
	let message = `You have a new WebToText lead!
Name: ${lead.Lead.Name}
Phone: ${lead.Lead.PhoneNumber}
Location: ${locationName}
Preferred Contact: ${lead.Lead.PreferredMethodOfContact}
Last Page Visited: ${lead.Lead.PageUrl}

`;

	if (lead.Lead.AssociatedProductInfo != null) {
		message += `Product(s) Inquired:
- Brand: ${lead.Lead.AssociatedProductInfo.Brand}, Line: ${lead.Lead.AssociatedProductInfo.Product}, Color: ${lead.Lead.AssociatedProductInfo.Variant}

`;
	}
	message += `Message:
${lead.Lead.CustomerMessage}`;

    return message;
}

export function SystemCloseMessage(dealerWebsiteURL?: string, dealerPhoneNumber?: string): string {
    let message ="Hello from Broadlume! We've marked this conversation as closed due to inactivity.";
    if (dealerWebsiteURL == null && dealerPhoneNumber == null) {
        return message;
    }
    message += ` If you would like to continue the conversation, please go to our website${dealerWebsiteURL ? ` at ${dealerWebsiteURL}` : ""}${dealerPhoneNumber ? ` or call us at ${dealerPhoneNumber}` : ""}`;
    return message;
}
