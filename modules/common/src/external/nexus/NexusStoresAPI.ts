import type { UUID } from "node:crypto";
import ky, { HTTPError } from "ky";
import { logger } from "../../logger";
import { GetNexusAWSAuthToken } from "./NexusAWSAuth";
import { NEXUS_AUTHORIZATION_HEADERS } from "./util";

export interface RetailerStore {
    birdeye_account_id: string;
    birdeye_business_account_id: string;
    call_tracking_number: string;
    city: string;
    country: string;
    hours_of_operation: string;
    id: string;
    latitude: string;
    location_id: string;
    location_name: string;
    longitude: string;
    mohawk_store_id: string;
    retailer_account_name: string;
    retailer_id: string;
    state_province: string;
    store_name: string;
    store_phone_number: string;
    Web2Text_Phone_Number?: string;
    store_type: string;
    street_address?: string;
    universal_id?: string;
    zip_code: string;
}

export async function GetAllRetailerStores(
    universalId: UUID,
    retryOnAuthFailure: boolean = true,
): Promise<RetailerStore[] | null> {
    const nexusURL = new URL(process.env.NEXUS_AWS_API_URL!);
    nexusURL.pathname += "nexus/retailerLocations";
    nexusURL.search = `?retailer_id=${universalId}`;
    const authToken = await GetNexusAWSAuthToken();
    try {
        const retailerStores = await ky
            .get(nexusURL.toString(), {
                retry: 0,
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
            })
            .json<{ data?: RetailerStore[] }>();
        return retailerStores.data ?? [];
    } catch (e) {
        if (e instanceof HTTPError) {
            if (e.response?.status === 404) return null;
            if (e.response?.status === 401 && retryOnAuthFailure) {
                // Try refresh nexus auth token
                await GetNexusAWSAuthToken(true);
                return GetAllRetailerStores(universalId, false);
            }
            throw e;
        }
        logger
            .child({ label: "NexusStoresAPI:GetAllRetailerStores" })
            .warn(`Error fetching retailer stores from Nexus for UniversalId '${universalId}'`);
        logger.child({ label: "NexusStoresAPI:GetAllRetailerStores" }).error(e);
        throw e;
    }
}
export async function GetRetailerStoreByID(
    locationId: string,
    retryOnAuthFailure: boolean = true,
): Promise<RetailerStore | null> {
    const nexusURL = new URL(process.env.NEXUS_AWS_API_URL!);
    nexusURL.pathname += "nexus/location";
    nexusURL.search = `?location_id=${locationId}`;
    const authToken = await GetNexusAWSAuthToken();
    try {
        const retailerStore = await ky
            .get(nexusURL.toString(), {
                retry: 0,
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
            })
            .json<{ data?: RetailerStore[] }>();
        return retailerStore.data?.[0] ?? null;
    } catch (e) {
        if (e instanceof HTTPError) {
            if (e.response?.status === 404 || e.response?.status === 400) return null;
            if (e.response?.status === 401 && retryOnAuthFailure) {
                // Try refresh nexus auth token
                await GetNexusAWSAuthToken(true);
                return GetRetailerStoreByID(locationId, false);
            }
            throw e;
        }
        logger
            .child({ label: "NexusStoresAPI:GetRetailerStoreByID" })
            .warn(`Error fetching retailer store from Nexus for Location ID: ${locationId}`);
        logger.child({ label: "NexusStoresAPI:GetRetailerStoreByID" }).error(e);
        throw e;
    }
}

export type HoursOfOperation = {
    TimeZone: string;
    Hours: {
        [key in "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN"]: {
            Closed: boolean;
            OpensAt: string;
            ClosesAt: string;
            ByAppointmentOnly: boolean;
        };
    };
};
type OldNexusAPIStoreResponse = {
    id: string;
    time_zone: string;
    hours_of_operation: {
        day: string;
        closed: boolean;
        opens_at: string;
        closes_at: string;
        by_appointment_only: boolean;
    }[];
};
export async function GetHoursOfOperation(
    universalRetailerId: string,
): Promise<Record<string, HoursOfOperation> | null> {
    const nexusURL = new URL(process.env.NEXUS_API_URL!);
    nexusURL.pathname += `retailers/${universalRetailerId}/stores`;
    try {
        const retailerStores = await ky
            .get(nexusURL.toString(), {
                retry: 0,
                timeout: 20_000,
                headers: NEXUS_AUTHORIZATION_HEADERS(),
            })
            .json<OldNexusAPIStoreResponse | OldNexusAPIStoreResponse[]>();
        const storeHours: Record<string, HoursOfOperation> = {};
        for (const store of [retailerStores].flat()) {
            storeHours[store.id] = {
                TimeZone: store.time_zone,
                Hours: store.hours_of_operation.reduce(
                    (acc, hour) => {
                        acc[hour.day as keyof HoursOfOperation["Hours"]] = {
                            Closed: hour.closed,
                            OpensAt: hour.opens_at,
                            ClosesAt: hour.closes_at,
                            ByAppointmentOnly: hour.by_appointment_only,
                        };
                        return acc;
                    },
                    {} as HoursOfOperation["Hours"],
                ),
            };
        }
        return storeHours;
    } catch (e) {
        if (e instanceof HTTPError) {
            if (e.response?.status === 404 || e.response?.status === 400) return null;
            throw e;
        }
        logger
            .child({ label: "NexusStoresAPI:GetHoursOfOperation" })
            .warn(
                `Error fetching retailer store(s) from Old Nexus API for Universal Retailer ID: '${universalRetailerId}'`,
            );
        logger.child({ label: "NexusStoresAPI:GetHoursOfOperation" }).error(e);
        throw e;
    }
}
