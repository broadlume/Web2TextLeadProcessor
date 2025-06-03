import ky from "ky";
import { logger } from "../../logger";
import { Into } from "..";
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
    universalRetailerId: string,
    request: Into<StoreInquiryRequest> | StoreInquiryRequest,
) {
    const dhqLead = request instanceof Into ? request.into() : request;
    const dhqUrl = new URL(process.env.DHQ_API_URL);
    dhqUrl.pathname += `retailer/rest/${universalRetailerId}/store_inquiries`;

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
            .warn("Failed to post lead to DHQ", { _meta: 1, DHQLead: dhqLead });
        logger.child({ label: "DHQStoreInquiryAPI:SubmitStoreInquiry" }).error(e);
        throw e;
    }
}

export async function AddCommentToInquiry(
    dhqLeadId: string,
    request: Into<AddCommentRequest> | AddCommentRequest,
): Promise<AddCommentResponse> {
    const dhqComment = request instanceof Into ? request.into() : request;

    const dhqUrl = new URL(process.env.DHQ_API_URL);
    dhqUrl.pathname += `retailer/rest/leads/${dhqLeadId}/comments`;
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
            .warn(`Failed to post comment on inquiry '${dhqLeadId}' to DHQ`, {
                _meta: 1,
                Comment: dhqComment,
            });
        logger.child({ label: "DHQStoreInquiryAPI:AddCommentToInquiry" }).error(e);
        throw e;
    }
}
