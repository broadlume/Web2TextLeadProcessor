import type { UUID } from "node:crypto";
import { NEXUS_AUTHORIZATION_HEADERS } from ".";

interface NexusRetailer {
    id: UUID,
    name: string,
    status: "Customer" | "Churned_Customer",
    website_url: string,
    salesforce_url: string,
    website_last_validated_at: string,
    temporary_website: boolean,
    primary_account_email?: string,
    primary_account_phone?: string,
    account_manager: {
        id: string,
        email: string,
        first_name: string,
        last_name: string
    },
    rlm_api_key?: string,
    preflight_completed_at?: string,
    corporate_name?: string,
    facebook_url?: string,
    linked_in_url?: string,
    twitter_url?: string,
    instagram_url?: string,
    pinterest_url?: string,
    youtube_url?: string
}

export async function Nexus_GetRetailerByID(universalId: UUID): Promise<NexusRetailer | null> {
    const nexusURL = new URL(process.env.NEXUS_API_URL!);
    nexusURL.pathname += `retailers/${universalId}`;

    const response = await fetch(nexusURL.toString(),{
        method: "GET",
        headers: NEXUS_AUTHORIZATION_HEADERS()
    });
    if (response.ok) {
        return await response.json() as NexusRetailer;
    }
    if (response.status === 404) {
        return null;
    }
    const error = await response.text().catch(() => response.status);
    throw new Error(`Failed to fetch retailer from Nexus for UniversalRetailerId: ${universalId}`, {cause: {status: response.status, error}});
}