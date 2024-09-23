import type { UUID } from "node:crypto";
import { NEXUS_AUTHORIZATION_HEADERS } from ".";
import ky, { HTTPError } from "ky";

export interface RetailerStore {
	"birdeye_account_id": string,
	"birdeye_business_account_id": string,
	"call_tracking_number": string,
	"city": string,
	"country": string,
	"hours_of_operation": string,
	"id": string,
	"latitude": string,
	"location_id": string,
	"location_name": string,
	"longitude": string,
	"mohawk_store_id": string,
	"retailer_account_name": string,
	"retailer_id": string,
	"state_province":string,
	"store_name": string,
	"store_phone_number": string,
	"Web2Text_Phone_Number"?: string,
	"store_type": string,
	"street_address": string,
	"universal_id": string,
	"zip_code": string
  }

export async function GetAllRetailerStores(
	universalId: UUID,
): Promise<RetailerStore[] | null> {
	const nexusURL = new URL(process.env.NEXUS_AWS_API_URL!);
	nexusURL.pathname += "nexus/retailerLocations";
	nexusURL.search = `?retailer_id=${universalId}`
	try {
		const retailerStores = await ky.get(nexusURL.toString(), {
			retry: 0,
			headers: NEXUS_AUTHORIZATION_HEADERS(),
		}).json<{data?: RetailerStore[]}>();
		return retailerStores.data ?? [];
	} catch (e) {
		if (e instanceof HTTPError && e.response.status === 404) {
            return null;
        }
        console.warn(`[GetAllRetailerStores]: Error fetching retailer stores from Nexus for UniversalId '${universalId}'`);
        throw e;
	}
}
export async function GetRetailerStoreByID(
	locationId: string
): Promise<RetailerStore | null> {
	const nexusURL = new URL(process.env.NEXUS_AWS_API_URL!);
	nexusURL.pathname += "nexus/location";
	nexusURL.search = `?location_id=${locationId}`;
	try {
		const retailerStore = await ky.get(nexusURL.toString(), {
			retry: 0,
			headers: NEXUS_AUTHORIZATION_HEADERS(),
		}).json<{data?: RetailerStore[]}>();
		return retailerStore.data?.[0] ?? null;
	} catch (e) {
		if (e instanceof HTTPError && (e.response.status === 404 || e.response.status === 400)) {
            return null;
        }
        console.warn("[GetRetailerStoreByID]: Error fetching retailer store from Nexus for Location ID: ${locationId}");
        throw e;
	}
}
