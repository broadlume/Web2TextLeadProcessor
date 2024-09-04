import type { Web2TextLead } from "../../types";
import type { TwilioIntegrationState } from "../twilio/TwilioIntegration";
import type { StoresAPI } from "../nexus";
import { DHQ_AUTHORIZATION_HEADERS } from ".";

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
			Id: string;
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
	/** Body of the comment */
	comment_body: string;
	/** ID of the comment author */
	comment_author_id: number;
}
export async function SubmitStoreInquiry(lead: Web2TextLead, storeInfo: StoresAPI.RetailerStore) {
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
      email: "poweredbytextdirect@broadlume.com",
      external_id: lead.LeadId,
      message: lead.Lead.CustomerMessage,
      name: lead.Lead.Name,
      page_url: lead.Lead.PageUrl,
      phone_number: lead.Lead.PhoneNumber,
      preferred_location: storeInfo.street_address,
      product: lead.Lead.AssociatedProductInfo ? {
        brand: lead.Lead.AssociatedProductInfo.Brand,
        name: lead.Lead.AssociatedProductInfo.Product,
        color: lead.Lead.AssociatedProductInfo.Variant
      } : undefined,
    },
    custom_fields: [
      {
        name: "Web2TextLeadID",
        value: lead.LeadId,
        displayable: false
      },
      {
        name: "Twilio Conversation SID",
        value: (lead.Integrations?.["Twilo"] as TwilioIntegrationState | undefined)?.Data?.ConversationSID ?? "null",
        displayable: false
      }
    ]
  }
	const dhqUrl = new URL(process.env.DHQ_API_URL);
	dhqUrl.pathname += `retailer/rest/${lead.UniversalRetailerId}/store_inquiries`;

	const headers = DHQ_AUTHORIZATION_HEADERS();
	headers.set("content-type", "application/json");
	const response = await fetch(dhqUrl.toString(), {
		method: "POST",
		headers: headers,
		body: JSON.stringify(dhqLead),
	});

	if (response.ok) {
		const responseBody = await response.json();
		return responseBody as StoreInquiryResponse;
	}
	const error = await response.text().catch((_) => response.status);
	throw new Error(
		`Failed to post lead '${lead.LeadId}' to DHQ`,
		{ cause: { status: response.status, error } },
	);
}
