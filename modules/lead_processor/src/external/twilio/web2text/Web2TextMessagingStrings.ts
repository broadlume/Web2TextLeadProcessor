import type { SubmittedLeadState } from "#lead";
import type { Web2TextLead } from "#lead/web2text";

export function SystemGreetingMessage(
	dealerName: string,
	contactPreference: string,
): string {
	return `Broadlume, a flooring software company, is facilitating this messaging conversation. We have connected you with ${dealerName}, and they will respond via ${contactPreference} shortly. Please text STOP to opt out of communication.`;
}
export function DealerGreetMessage(
	lead: SubmittedLeadState<Web2TextLead>,
	locationName: string,
): string {
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

export function CustomerCloseMessage(
	dealerName?: string,
	dealerWebsiteURL?: string,
	storePhoneNumber?: string,
): string {
	let message = "This message thread has expired.";
	if (
		dealerName === null ||
		(dealerWebsiteURL == null && storePhoneNumber == null)
	) {
		return message;
	}
	message += ` If you would like to speak to ${dealerName}, please go to our website${dealerWebsiteURL ? ` at ${dealerWebsiteURL}` : ""}${storePhoneNumber ? ` or call us at ${storePhoneNumber}` : ""}`;
	return message;
}

export function DealerCloseMessage(customerName?: string, reason?: string) {
	let message = "This message thread has expired.";
	if (customerName) {
		message = `This message thread with ${customerName} has expired, please reach out to the customer directly.`;
	}
	if (reason) {
		message += `\n\nReason: ${reason}`;
	}
	return message;
}
