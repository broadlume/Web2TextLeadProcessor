import * as restate from "@restatedev/restate-sdk";
import { z } from "zod";
import {
	CheckClientStatus,
	CheckLocationStatus,
	CheckAuthorization,
} from "./validators";
import { NexusStoresAPI } from "../external/nexus";
import { assert, is } from "tsafe";
import type { UUID } from "node:crypto";
import parsePhoneNumber from "libphonenumber-js";

type LocationStatus = {
	NexusLocationId: string;
	Name?: string;
	Address?: string;
	PhoneNumber?: string;
	Hours?: string;
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
                // biome-ignore lint/suspicious/noExplicitAny: <explanation>
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
					throw new restate.TerminalError("Invalid UniversalRetailerId", {
						errorCode: 400,
					});
				}
				assert(is<UUID>(universalRetailerId));

				const dealerStatus = await ctx.run(
					"Check retailer eligiblity for Web2Text",
					async () => await CheckClientStatus(universalRetailerId),
				);
				if (dealerStatus.Status !== "VALID") {
					return { Status: dealerStatus.Status, Reason: dealerStatus.Reason };
				}
				const locations =
					(await ctx.run(
						"Fetch location info",
						async () =>
							await NexusStoresAPI.GetAllRetailerStores(universalRetailerId),
					)) ?? [];

				const locationStatuses: LocationStatus[] = [];
				for (const location of locations) {
					const locationStatus = await ctx.run(
						"Check location status",
						async () => await CheckLocationStatus(location.id as UUID),
					);
					const phoneNumber = parsePhoneNumber(
						location.Web2Text_Phone_Number ?? "",
						"US",
					);
					const status: LocationStatus = {
						NexusLocationId: location.id,
						// biome-ignore lint/suspicious/noDoubleEquals: <explanation>
						Name: location.store_name == "" ? undefined : location.store_name,
						Address:
							// biome-ignore lint/suspicious/noDoubleEquals: <explanation>
							location.street_address == ""
								? undefined
								: location.street_address,
						PhoneNumber: phoneNumber?.number,

						Hours:
							// biome-ignore lint/suspicious/noDoubleEquals: <explanation>
							location.hours_of_operation == ""
								? undefined
								: location.hours_of_operation,
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
