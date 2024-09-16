import type { Web2TextLead } from "../../types";

export function SystemGreetingMessage(dealerName: string): string {
	return `This messaging conversation is being facilitated by Broadlume, a flooring software company. We have connected you with ${dealerName}. Please text STOP to opt out of communication.`
}
export function DealerGreetMessage(lead: Web2TextLead, locationName: string): string {
	let message = `You have a new Web2Text lead!
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

export function CustomerCloseMessage(dealerName: string, dealerWebsiteURL?: string, dealerPhoneNumber?: string): string {
    let message ="This message thread has expired.";
    if (dealerWebsiteURL == null && dealerPhoneNumber == null) {
        return message;
    }
    message += ` If you would like to speak to ${dealerName}, please go to our website${dealerWebsiteURL ? ` at ${dealerWebsiteURL}` : ""}${dealerPhoneNumber ? ` or call us at ${dealerPhoneNumber}` : ""}`;
    return message;
}

export function DealerCloseMessage(customerName: string, reason?: string) {
    return `This message thread with ${customerName} has expired, please reach out to the customer directly.\n\nReason: ${reason}`;
}
