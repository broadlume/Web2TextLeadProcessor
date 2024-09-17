import * as restate from "@restatedev/restate-sdk";
import { z } from "zod";
import { CheckClientStatus, CheckLocationStatus, ValidateAPIKey } from "./validators";
import { NexusStoresAPI } from "../external/nexus";
import { assert, is } from "tsafe";
import type { UUID } from "node:crypto";

type LocationStatus = {
    LocationId: string,
    Name?: string,
    Address: string,
    PhoneNumber: string,
    Status: "ELIGIBLE" | "INELIGIBLE" | "NONEXISTANT";
    Reason?: string;
};
type DealerStatusResponse =
	| {
			Status: "INELIGIBLE" | "NONEXISTANT";
            Reason?: string;
	  }
	| {
			Status: "ELIGIBLE";
			Locations: LocationStatus[];
	  };
export const DealerVirtualObject = restate.object({
	name: "Dealer",
	handlers: {
        /**
         * Gives back a report on whether or not this dealer can have Web2Text on their website and for which locations
         */
		status: restate.handlers.object.shared(
			{
				input: restate.serde.empty,
			},
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			async (ctx: restate.ObjectSharedContext, req?: Record<string, any>): Promise<DealerStatusResponse> => {
				// Validate the API key
				await ValidateAPIKey(
					ctx,
					ctx.request().headers.get("authorization") ?? req?.["API_KEY"],
				);
				const universalRetailerId = ctx.key;
				if (
					z.string().uuid().safeParse(universalRetailerId).success === false
				) {
					throw new restate.TerminalError("Invalid UniversalRetailerId");
				}
				assert(is<UUID>(universalRetailerId));

                const dealerStatus = await ctx.run("Check retailer eligiblity for Web2Text", async () => await CheckClientStatus(universalRetailerId));
                if (dealerStatus.Status !== "ELIGIBLE") {
                    return {Status: dealerStatus.Status, Reason: dealerStatus.Reason};
                }
                const locations = await ctx.run("Fetch location info", async () => await NexusStoresAPI.GetAllRetailerStores(universalRetailerId)) ?? [];
                
                const locationStatuses: LocationStatus[] = [];
                for (const location of locations) {
                    const locationStatus = await ctx.run("Check location status", async () => await CheckLocationStatus(location.id as UUID));
                    const status: LocationStatus = {
                        LocationId: location.universal_id,
                        // biome-ignore lint/suspicious/noDoubleEquals: <explanation>
                        Name: location.store_name == "" ? undefined : location.store_name,
                        Address: location.street_address,
                        PhoneNumber: location.store_phone_number,
                        ...locationStatus
                    }
                    locationStatuses.push(status);
                }
                return {
                    Status: "ELIGIBLE",
                    Locations: locationStatuses
                };
			},
		),
	},
});
