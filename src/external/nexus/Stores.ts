import type { UUID } from "node:crypto";
import { NEXUS_AUTHORIZATION_HEADERS } from ".";

interface RetailerStore {
    id: UUID,
    name: string,
    address: {
        city: string,
        state: string,
        coordinates: {
            latitude: number,
            longitude: number
        },
        street_number: string,
        street_name: string,
        secondary_address: string,
        postal_code: string,
        country_code: string
    },
    services: string[],
    retailer_id: UUID,
    location_name: string,
    phone_number: string,
    time_zone: string,
    hours_of_operation: {
        day: string,
        closed: boolean,
        opens_at: string,
        closes_at: string,
        by_appointment_only: boolean
    }[],
    google_place_id: string,
    premium_location: boolean
}

export async function Nexus_GetAllRetailerStores(universalId: UUID): Promise<RetailerStore[] | null> {
    const nexusURL = new URL(process.env.NEXUS_API_URL!);
    nexusURL.pathname += `retailers/${universalId}/stores`;

    const response = await fetch(nexusURL,{
        method: "GET",
        headers: NEXUS_AUTHORIZATION_HEADERS()
    });
    if (response.ok) {
        return await response.json() as RetailerStore[];
    }
    if (response.status === 404) {
        return null;
    }
    const error = await response.json().catch(() => response.status);
    throw new Error(`Failed to fetch retailer stores from Nexus for UniversalClientId: ${universalId}`, {cause: error});
}
export async function Nexus_GetRetailerStoreByID(universalId: UUID, locationId: UUID): Promise<RetailerStore | null> {
    const nexusURL = new URL(process.env.NEXUS_API_URL!);
    nexusURL.pathname += `retailers/${universalId}/stores/${locationId}`;

    const response = await fetch(nexusURL,{
        method: "GET",
        headers: NEXUS_AUTHORIZATION_HEADERS()
    });
    if (response.ok) {
        return await response.json() as RetailerStore;
    }
    if (response.status === 404) {
        return null;
    }
    const error = await response.json().catch(() => response.status);
    throw new Error(`Failed to fetch retailer stores from Nexus for UniversalClientId: ${universalId}`, {cause: error});
}