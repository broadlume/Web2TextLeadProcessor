import type { UUID } from "node:crypto";
import { NEXUS_AUTHORIZATION_HEADERS } from ".";

interface RetailerStore {
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
	"store_type": string,
	"street_address": string,
	"universal_id": string,
	"zip_code": string
  }

export async function Nexus_GetAllRetailerStores(
	universalId: UUID,
): Promise<RetailerStore[] | null> {
	const nexusURL = new URL(process.env.NEXUS_AWS_API_URL!);
	nexusURL.pathname += "/nexus/retailerLocations";
	nexusURL.search = `?retailer_id=${universalId}`

	const response = await fetch(nexusURL.toString(), {
		method: "GET",
		headers: NEXUS_AUTHORIZATION_HEADERS(),
	});
	if (response.ok) {
		const json = await response.json() as {data: RetailerStore[]};
		if ("data" in json && json.data.length > 0) {
			return json.data;
		}
		return null;
	}
	if (response.status === 404) {
		return null;
	}
	const error = await response.text().catch(() => response.status);
	throw new Error(
		`Failed to fetch retailer stores from Nexus for UniversalClientId: ${universalId}`,
		{ cause: { status: response.status, error } },
	);
}
export async function Nexus_GetRetailerStoreByID(
	locationId: string
): Promise<RetailerStore | null> {
	const nexusURL = new URL(process.env.NEXUS_AWS_API_URL!);
	nexusURL.pathname += "/nexus/location";
	nexusURL.search = `?location_id=${locationId}`;

	const response = await fetch(nexusURL.toString(), {
		method: "GET",
		headers: NEXUS_AUTHORIZATION_HEADERS(),
	});
	if (response.ok) {
		const json = await response.json() as {data: RetailerStore[]};
		if ("data" in json && json.data.length > 0) {
			return json.data[0];
		}
		return null;
	}
	if (response.status === 404 || response.status === 400) {
		return null;
	}
	const error = await response.text().catch(() => response.status);
	throw new Error(
		`Failed to fetch retailer store from Nexus for Location ID: ${locationId}`,
		{ cause: { status: response.status, error } },
	);
}
