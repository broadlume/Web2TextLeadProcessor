import ky from "ky";
import type { MessageInstance } from "twilio/lib/rest/conversations/v1/conversation/message";
import type { Jsonify } from "type-fest";
import { DHQ_AUTHORIZATION_HEADERS } from ".";
import { logger } from "../../logger";
import type { Web2TextLead } from "../../../web2text/types";
import type { NexusStoresAPI } from "../nexus";
import type { TwilioIntegrationState } from "../../../web2text/external/twilio/TwilioIntegration";

/**
 * Possible flooring interests
 */
export type FlooringInterest =
	| "bamboo"
	| "bathroom"
	| "bindings"
	| "cabinets"
	| "carpet"
	| "cleaning"
	| "commercial"
	| "cork"
	| "countertops"
	| "hardwood"
	| "installation"
	| "kitchen"
	| "laminate"
	| "lighting"
	| "luxury vinyl"
	| "natural stone"
	| "other"
	| "painting"
	| "refinishing"
	| "remodeling"
	| "repairs"
	| "residential"
	| "resilient flooring"
	| "rugs"
	| "stairs"
	| "tile"
	| "vinyl"
	| "wall tiles"
	| "waterproof"
	| "windows";

/**
 * Possible room interests
 */
export type RoomInterest =
	| "bedroom"
	| "bathroom"
	| "other"
	| "living_room"
	| "family_room"
	| "kitchen"
	| "patio"
	| "stairs"
	| "multiple_rooms";

/**
 * Represents the main request body for submitting a store inquiry
 */
export interface StoreInquiryRequest {
	/** UTC timestamp when the inquiry occurred */
	occurred_at: string;
	/** Address of the store */
	store_address?: string;
	/** Unique identifier for the store */
	universal_store_id?: string;
	/** Traffic information */
	traffic?: {
		source?: string;
		medium?: string;
		campaign?: string;
		term?: string;
		content?: string;
	};
	/** Array of custom fields */
	custom_fields?: {
		name: string;
		value: string;
		displayable: boolean;
	}[];
	/** Inquiry details */
	inquiry: {
		/** Unique identifier for the inquiry */
		external_id: string;
		/** Email address of the inquirer */
		email: string;
		/** Name of the inquirer */
		name: string;
		/** Array of flooring interests */
		flooring_interests?: FlooringInterest[];
		/** Array of room interests */
		room_interests?: RoomInterest[];
		/** Inquiry message */
		message?: string;
		/** Phone number of the inquirer */
		phone_number?: string;
		/** URL of the page where the inquiry was made */
		page_url?: string;
		/** Method of contact */
		contact_method: "cys_inquiry" | "kiosk";
		/** Preferred location */
		preferred_location?: string;
		/** Address of the visitor */
		visitor_address?: string;
		/** Product information */
		product?: {
			name?: string;
			brand?: string;
			color?: string;
			sku?: string;
		};
	};
}

/**
 * Represents the response from the API for a store inquiry
 */
export interface StoreInquiryResponse {
	/** Status of the response */
	status: "success" | "failure";
	/** Response data (only present if status is 'success') */
	data?: {
		/** Store inquiry information */
		store_inquiry: {
			/** Unique identifier for the store inquiry */
			id: string;
			/** External identifier for the inquiry */
			external_id: string;
			/** Array of flooring interests */
			flooring_interests: FlooringInterest[];
			/** Name of the inquirer */
			name: string;
			/** Email of the inquirer */
			email: string;
			/** Inquiry message */
			message: string;
			/** Phone number of the inquirer */
			phone_number: string;
			/** Array of room interests */
			room_interests: RoomInterest[];
			/** Address of the store */
			store_address: string | null;
		};
		/** Lead information */
		lead: {
			/** Unique identifier for the lead */
			id: string;
			/** Source of the traffic */
			traffic_source: string;
			/** Medium of the traffic */
			traffic_medium: string;
			/** Campaign name */
			traffic_campaign: string;
			/** Search term used */
			Traffic_term: string;
			/** Content identifier */
			traffic_content: string;
			/** URL of the page where the inquiry was made */
			page_url: string;
		};
	};
	/** Array of error messages (only present if status is 'failure') */
	errors?: string[];
}

/**
 * Represents the request body for adding a comment to a lead
 */
export interface AddCommentRequest {
	comment: {
		/** Body of the comment
		 * Supports Markdown
		 */
		body: string;
		/** ID of the comment author */
		author_id: number;
	};
}
export type AddCommentResponse = {
	status: "success" | "failure";
	data: {
		comment: {
			id: string;
			author_id: number;
			lead_id: string;
			inferred_prospect_id: string;
			body: string;
			body_html: string;
			created_at: string;
			updated_at: string;
		};
		lead: {
			archived_at: null | string;
			chat_id: null | string;
			current_status_id: null | string;
			current_assignment_id: null | string;
			custom_fields: {
				name: string;
				value: string;
				displayable: boolean;
			}[];
			id: string;
			lead_category: string;
			lead_subcategory: string;
			manufacturer_promo_ad_submission_id: null | string;
			occurred_at: string;
			order_id: null | string;
			page_url: string;
			phone_call_id: null | string;
			retailer_id: string;
			store_id: null | string;
			store_inquiry_id: string;
			traffic_source: string;
			traffic_medium: string;
			traffic_campaign: string;
			traffic_term: string;
			traffic_content: string;
			reaction: null | string;
			vectors: string;
			visualization_id: null | string;
			inferred_prospect_id: string;
			floorlytics_blob: unknown;
			walk_in_id: null | string;
			created_at: string;
			updated_at: string;
		};
	};
	errors: string[];
};
export async function SubmitStoreInquiry(
	lead: Web2TextLead,
	storeInfo: NexusStoresAPI.RetailerStore,
) {
	const dhqLead: StoreInquiryRequest = {
		occurred_at: lead.DateSubmitted,
		store_address: storeInfo.street_address,
		universal_store_id: storeInfo.universal_id,
		traffic: {
			source: "Other",
			medium: "Referral",
			campaign: "Web2Text",
		},
		inquiry: {
			contact_method: "cys_inquiry",
			email: `poweredbytextdirect+${lead.Lead.PhoneNumber.replace(/\D+/g, "")}@broadlume.com`,
			external_id: lead.LeadId,
			message: lead.Lead.CustomerMessage,
			name: lead.Lead.Name,
			page_url: lead.Lead.PageUrl,
			phone_number: lead.Lead.PhoneNumber,
			preferred_location: storeInfo.street_address,
			product: lead.Lead.AssociatedProductInfo
				? {
						brand: lead.Lead.AssociatedProductInfo.Brand,
						name: lead.Lead.AssociatedProductInfo.Product,
						color: lead.Lead.AssociatedProductInfo.Variant,
					}
				: undefined,
		},
		custom_fields: [
			{
				name: "Web2TextLeadID",
				value: lead.LeadId,
				displayable: false,
			},
			{
				name: "Twilio Conversation SID",
				value:
					(lead.Integrations?.["Twilio"] as TwilioIntegrationState | undefined)
						?.Data?.ConversationSID ?? "null",
				displayable: false,
			},
		],
	};
	if (dhqLead.inquiry.preferred_location == null) {
		delete dhqLead.inquiry.preferred_location;
	}
	const dhqUrl = new URL(process.env.DHQ_API_URL);
	dhqUrl.pathname += `retailer/rest/${lead.UniversalRetailerId}/store_inquiries`;

	const headers = DHQ_AUTHORIZATION_HEADERS();
	try {
		const response = await ky
			.post(dhqUrl.toString(), {
				headers: headers,
				json: dhqLead,
			})
			.json<StoreInquiryResponse>();
		return response;
	} catch (e) {
		logger
			.child({ label: "DHQStoreInquiryAPI:SubmitStoreInquiry" })
			.warn(`Failed to post lead '${lead.LeadId}' to DHQ`);
		logger.child({ label: "DHQStoreInquiryAPI:SubmitStoreInquiry" }).error(e);
		throw e;
	}
}

export async function AddCommentToInquiry(
	leadId: string,
	web2TextLead: Web2TextLead,
	twilioMessage: Jsonify<MessageInstance>,
): Promise<AddCommentResponse> {
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
	const dhqComment: AddCommentRequest = {
		comment: {
			// Double any newline because DHQ doesn't render them correctly
			body: `**| ${senderName}**: ${messageBody.replaceAll("\n", "\n\n")}`,
			author_id: 262,
		},
	};

	const dhqUrl = new URL(process.env.DHQ_API_URL);
	dhqUrl.pathname += `retailer/rest/leads/${leadId}/comments`;
	const headers = DHQ_AUTHORIZATION_HEADERS();
	try {
		const response = await ky
			.post(dhqUrl.toString(), {
				headers: headers,
				json: dhqComment,
			})
			.json<AddCommentResponse>();
		return response;
	} catch (e) {
		logger
			.child({ label: "DHQStoreInquiryAPI:AddCommentToInquiry" })
			.warn(
				`Failed to post twilio message '${twilioMessage.sid}' on inquiry '${leadId}' to DHQ`,
			);
		logger.child({ label: "DHQStoreInquiryAPI:AddCommentToInquiry" }).error(e);
		throw e;
	}
}
