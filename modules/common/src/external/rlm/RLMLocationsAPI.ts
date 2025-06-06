import type { UUID } from "node:crypto";
import { logger } from "common";
import ky from "ky";
import memoizee from "memoizee";

export type RLMDHQLocationMappingResponse = {
    organization_id: number;
    organization_name: string;
    location_id: number;
    location_name: string;
    dhq_store_id: UUID;
}[];

const RLM_GOD_AUTHORIZATION_HEADERS = () => {
    const headers = new Headers();
    headers.set("X-Api-Key", process.env.RLM_GOD_API_KEY!);
    headers.set("X-User-Email", process.env.RLM_GOD_EMAIL!);
    return headers;
};

async function _getDHQLocationsMapping(): Promise<RLMDHQLocationMappingResponse> {
    const rlmURL = new URL(process.env.RLM_API_URL);
    rlmURL.pathname += "api/v1/dhq_store_rlm_location_mappings.json";
    try {
        const response = await ky
            .get(rlmURL.toString(), {
                timeout: 60_000,
                retry: 0,
                headers: RLM_GOD_AUTHORIZATION_HEADERS(),
            })
            .json<RLMDHQLocationMappingResponse>();
        return response;
    } catch (e) {
        logger
            .child({ label: "RLMLocationsAPI:GetDHQLocationsMapping" })
            .warn("Failed to get DHQ locations mapping from RLM");
        logger.child({ label: "RLMLocationsAPI:GetDHQLocationsMapping" }).error(e);
        throw e;
    }
}

export const GetDHQLocationsMapping = memoizee(_getDHQLocationsMapping, {
    promise: true,
    maxAge: 1000 * 60 * 60, // 1 hour
    preFetch: true,
});
