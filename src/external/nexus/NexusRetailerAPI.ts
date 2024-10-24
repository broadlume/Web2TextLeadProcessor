import type { UUID } from "node:crypto";
import ky, { HTTPError } from "ky";
import { NEXUS_AUTHORIZATION_HEADERS } from ".";
import { logger } from "../../logger";

export interface NexusRetailer {
	id: UUID;
	name: string;
	status: "Customer" | "Churned_Customer";
	website_url: string;
	salesforce_url: string;
	website_last_validated_at: string;
	temporary_website: boolean;
	primary_account_email?: string;
	primary_account_phone?: string;
	account_manager: {
		id: string;
		email: string;
		first_name: string;
		last_name: string;
	};
	rlm_api_key?: string;
	preflight_completed_at?: string;
	corporate_name?: string;
	facebook_url?: string;
	linked_in_url?: string;
	twitter_url?: string;
	instagram_url?: string;
	pinterest_url?: string;
	youtube_url?: string;
}

export interface NexusSubscription {
	id: UUID;
	name: string;
	status: string;
	price: number;
	retailer_id: UUID;
	broadlume_product: {
		id: UUID;
		name: string;
		type: string;
		brand: string;
		family: string;
		recurring: boolean;
		revenue_bucket: string;
	};
	live_date: string;
	extra_data: {
		premium_locations: string;
		included_premium_locations: string;
	};
	web2text_opt_out: boolean;
	broadlume_product_name: string;
	broadlume_product_type: string;
	broadlume_product_id: UUID;
	subscription_status: string;
	subscription_name: string;
	subscription_id: UUID;
}
export async function GetRetailerByID(
	universalId: UUID,
): Promise<NexusRetailer | null> {
	const nexusURL = new URL(process.env.NEXUS_API_URL!);
	nexusURL.pathname += `retailers/${universalId}`;

	try {
		const retailer = await ky
			.get(nexusURL.toString(), {
				retry: 0,
				headers: NEXUS_AUTHORIZATION_HEADERS(),
			})
			.json<NexusRetailer>();
		return retailer;
	} catch (e) {
		if (e instanceof HTTPError && e.response.status === 404) {
			return null;
		}
		logger
			.child({ label: "NexusRetailerAPI:GetRetailerSubscriptions" })
			.warn("Error fetching retailer from Nexus");
		logger
			.child({ label: "NexusRetailerAPI:GetRetailerSubscriptions" })
			.error(e);
		throw e;
	}
}

export async function GetRetailerSubscriptions(
	universalId: UUID,
): Promise<NexusSubscription[] | null> {
	const nexusURL = new URL(process.env.NEXUS_API_URL!);
	nexusURL.pathname += `retailers/${universalId}/subscriptions`;

	try {
		const retailer = await ky
			.get(nexusURL.toString(), {
				retry: 0,
				headers: NEXUS_AUTHORIZATION_HEADERS(),
			})
			.json<NexusSubscription[]>();
		return retailer;
	} catch (e) {
		if (e instanceof HTTPError && e.response.status === 404) {
			return null;
		}
		logger
			.child({ label: "NexusRetailerAPI:GetRetailerSubscriptions" })
			.warn("Error fetching retailer subscriptions from Nexus");
		logger
			.child({ label: "NexusRetailerAPI:GetRetailerSubscriptions" })
			.error(e);
		throw e;
	}
}
