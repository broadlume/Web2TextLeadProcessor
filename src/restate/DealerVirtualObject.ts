import type { UUID } from "node:crypto";
import * as restate from "@restatedev/restate-sdk";
import parsePhoneNumber from "libphonenumber-js";
import { assert, is } from "tsafe";
import { z } from "zod";
import { NexusStoresAPI } from "../external/nexus";
import {
	CheckAuthorization,
	CheckClientStatus,
	CheckLocationStatus,
} from "./validators";

type LocationStatus = {
	NexusLocationId: string;
	UniversalLocationId?: string;
	Name?: string;
	City?: string;
	State?: string;
	ZipCode?: string;
	StreetAddress?: string;
	Web2TextPhoneNumber?: string;
	StorePhoneNumber?: string;
	CallTrackingPhoneNumber?: string;
	Status: "VALID" | "INVALID" | "NONEXISTANT";
	Reason?: string;
};
type DealerStatusResponse =
	| {
			Status: "INVALID" | "NONEXISTANT";
			Reason?: string;
	  }
	| {
			Status: "VALID";
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
			async (
				ctx: restate.ObjectSharedContext,
				req?: Record<string, any>,
			): Promise<DealerStatusResponse> => {
				// Validate the API key
				await CheckAuthorization(
					ctx,
					`${DealerVirtualObject.name}/status`,
					ctx.request().headers.get("authorization") ?? req?.["API_KEY"],
				);
				const universalRetailerId = ctx.key;
				if (
					z.string().uuid().safeParse(universalRetailerId).success === false
				) {
					throw new restate.TerminalError(
						`Invalid UniversalRetailerId: '${universalRetailerId}'`,
						{
							errorCode: 400,
						},
					);
				}
				assert(is<UUID>(universalRetailerId));

				const dealerStatus = await ctx.run(
					"Check retailer eligiblity for Web2Text",
					async () => await CheckClientStatus(universalRetailerId),
					{
						maxRetryAttempts: 4,
						initialRetryIntervalMillis: 1000,
					},
				);
				if (dealerStatus.Status !== "VALID") {
					return { Status: dealerStatus.Status, Reason: dealerStatus.Reason };
				}
				const locations =
					(await ctx.run(
						"Fetch location info",
						async () =>
							await NexusStoresAPI.GetAllRetailerStores(universalRetailerId),
						{
							maxRetryAttempts: 4,
							initialRetryIntervalMillis: 1000,
						},
					)) ?? [];
				const locationStatuses: LocationStatus[] = [];
				const undefinedIfEmpty = (x: string | null | undefined) =>
					x === "" || x == null ? undefined : x;
				for (const location of locations) {
					const locationStatus = await ctx.run(
						"Check location status",
						async () => await CheckLocationStatus(location),
					);
					const web2TextPhoneNumber = parsePhoneNumber(
						location.Web2Text_Phone_Number ?? "",
						"US",
					);
					const storePhoneNumber = parsePhoneNumber(
						location.store_phone_number ?? "",
						"US",
					);
					const callTrackingPhoneNumber = parsePhoneNumber(
						location.call_tracking_number ?? "",
						"US",
					);
					const status: LocationStatus = {
						NexusLocationId: location.id,
						UniversalLocationId: location.universal_id,
						Name: undefinedIfEmpty(
							location.location_name ?? location.store_name,
						),
						StreetAddress: undefinedIfEmpty(location.street_address),
						City: undefinedIfEmpty(location.city),
						State: undefinedIfEmpty(location.state_province),
						ZipCode: undefinedIfEmpty(location.zip_code),
						Web2TextPhoneNumber: web2TextPhoneNumber?.number,
						StorePhoneNumber: storePhoneNumber?.number,
						CallTrackingPhoneNumber: callTrackingPhoneNumber?.number,
						...locationStatus,
					};
					locationStatuses.push(status);
				}
				return {
					Status: "VALID",
					Locations: locationStatuses,
				};
			},
		),
	},
});
