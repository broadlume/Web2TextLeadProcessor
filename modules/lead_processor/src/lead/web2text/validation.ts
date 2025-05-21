import type { UUID } from "node:crypto";
import { logger } from "common";
import { NexusRetailerAPI } from "common/external/nexus";
import { NexusStoresAPI } from "common/external/nexus";
import { TwilioLookupAPI } from "common/external/twilio";
import type { E164Number } from "libphonenumber-js";
import parsePhoneNumber from "libphonenumber-js";
import type { Twilio } from "twilio";
import { OptedOutNumberModel } from "#dynamodb";
import type { Validator, ValidationStatus } from "../validation";
import type { NonValidatedLeadState } from "#lead/schema";
import type { Web2TextLead } from "./schema";
import type * as restate from "@restatedev/restate-sdk";
export class Web2TextLeadValidator implements Validator<NonValidatedLeadState<Web2TextLead>> {
    private readonly ctx: restate.ObjectSharedContext;
    constructor(ctx: restate.ObjectSharedContext) {
        this.ctx = ctx;
    }
    public async validate(leadState: NonValidatedLeadState<Web2TextLead>): Promise<ValidationStatus> {
        const lead = leadState.Lead;
        if (lead.IPAddress != null) {
            const ipAddressValid = await this.ctx.run<ValidationStatus>(
                "IP address validation",
                async () => await CheckIpAddressStatus(lead.IPAddress!),
            );
            if (ipAddressValid.Status !== "VALID") {
                return ipAddressValid;
            }
        }
        const clientStatus = await this.ctx.run<ValidationStatus>(
            "Client status check",
            async () => await CheckClientStatus(leadState.UniversalRetailerId),
        );
        if (clientStatus.Status !== "VALID") {
            return clientStatus;
        }

        const locationStatus = await this.ctx.run<ValidationStatus>(
            "Location validation",
            async () => await CheckLocationStatus(lead.LocationId),
        );
        if (locationStatus.Status !== "VALID") {
            return locationStatus;
        }
        const storePhoneNumber = parsePhoneNumber(
            (
                await this.ctx.run(
                    "Get store phone number",
                    async () =>
                        await NexusStoresAPI.GetRetailerStoreByID(lead.LocationId),
                )
            )?.Web2Text_Phone_Number ?? "",
            "US",
        );

        if (storePhoneNumber?.number === lead.PhoneNumber) {
            return {
                Name: "Phone Number",
                Status: "INVALID",
                Reason: "Customer phone number is the same as the store's phone number",
            };
        }

        const customerPhoneStatus = await this.ctx.run(
            "Customer phone validation",
            async () =>
                await CheckPhoneNumberStatus(
                    globalThis.TWILIO_CLIENT,
                    lead.PhoneNumber,
                ),
        );
        if (customerPhoneStatus.Status !== "VALID") {
            return customerPhoneStatus;
        }
        return {
            Name: "Web2Text Lead",
            Status: "VALID",
        };
    }
}
/**
 * Validate that a given IP address is not blocked and allowed to submit a lead
 * @param ipAddress the IP address to check
 * @returns true if the IP is allowed, false otherwise
 */
export async function CheckIpAddressStatus(
	ipAddress: string,
): Promise<ValidationStatus> {
	return {
		Name: "IP Address",
		Status: "VALID",
	};
}
/**
 * Validate that the client the lead is being submitted to exists and is VALID to receive Web2Text leads
 * @param universalId the universal client ID of the client
 * @returns a ClientStatus type
 */
export async function CheckClientStatus(
	universalId: UUID,
): Promise<ValidationStatus> {
	const nexusRetailer = await NexusRetailerAPI.GetRetailerByID(universalId);
	if (nexusRetailer == null)
		return {
			Name: "Client",
			Status: "NONEXISTANT",
			Reason: "Could not find client with this UniversalRetailerId in Nexus",
		};
	if (nexusRetailer.status === "Churned_Customer")
		return {
			Name: "Client",
			Status: "INVALID",
			Reason: "Nexus has flagged this retailer as a churned customer",
		};

	const nexusSubscriptions =
		(await NexusRetailerAPI.GetRetailerSubscriptions(universalId)) ?? [];
	if (
		nexusSubscriptions.find(
			(s) => s.status !== "Cancelled" && s.web2text_opt_out === true,
		)
	) {
		return {
			Name: "Client",
			Status: "INVALID",
			Reason: "Retailer is opted out of Web2Text",
		};
	}
	return {
		Name: "Client",
		Status: "VALID",
	};
}

/**
 * Validate that the location ID exists
 * @param universalId the universal client ID
 * @param locationId the location ID within the client
 * @returns true if the location exists, false otherwise
 */
export async function CheckLocationStatus(
	location: UUID | NexusStoresAPI.RetailerStore | null,
): Promise<ValidationStatus> {
	if (typeof location === "string") {
		location = await NexusStoresAPI.GetRetailerStoreByID(location);
	}
	if (location == null)
		return {
			Name: "Location",
			Status: "NONEXISTANT",
			Reason: "Could not find location with this Id in Nexus",
		};
	if (
		location.Web2Text_Phone_Number == null ||
		location.Web2Text_Phone_Number.trim() === ""
	) {
		return {
			Name: "Location",
			Status: "INVALID",
			Reason:
				"Location does not have a Web2Text phone number associated in Nexus",
		};
	}
	const locationPhone = parsePhoneNumber(location.Web2Text_Phone_Number, "US");
	if (locationPhone == null) {
		return {
			Name: "Location",
			Status: "INVALID",
			Reason: `Location's phone number cannot be parsed: '${location.Web2Text_Phone_Number}'`,
		};
	}
	const phoneNumberStatus = await CheckPhoneNumberStatus(
		globalThis.TWILIO_CLIENT,
		locationPhone!.number,
	);
	if (phoneNumberStatus.Status === "INVALID") {
		return phoneNumberStatus;
	}
	return {
		Name: "Location",
		Status: "VALID",
	};
}
/**
 * Check if phone number is opted out of text messaging
 * @param phoneNumber the number to check, in E164 format
 * @returns true if the number is opted out of text messaging, false if not
 */
export async function IsPhoneNumberOptedOut(
	phoneNumber: E164Number,
): Promise<boolean> {
	const optedOut = await OptedOutNumberModel.get(phoneNumber);
	return optedOut != null;
}

export async function CheckPhoneNumberStatus(
	twilioClient: Twilio,
	phoneNumber: E164Number | undefined,
): Promise<ValidationStatus> {
	if (phoneNumber == null) {
		return {
			Name: "Phone Number",
			Status: "NONEXISTANT",
			Reason: "Phone number is missing",
		};
	}
	const optedOut = await IsPhoneNumberOptedOut(phoneNumber);
	if (optedOut) {
		return {
			Name: "Phone Number",
			Status: "INVALID",
			Reason: "Phone number is opted-out from our text messaging pool",
		};
	}

	const lookup = await TwilioLookupAPI.LookupPhoneNumber(
		twilioClient,
		phoneNumber,
	);
	if (lookup.valid === false) {
		return {
			Name: "Phone Number",
			Status: "INVALID",
			Reason: `Twilio lookup reported this number as invalid - [${lookup.validationErrors.join(", ")}]`,
		};
	}
	const lineTypeError: number | null = lookup.lineTypeIntelligence
		?.error_code as unknown as number | null;
	if (lineTypeError != null) {
		logger
			.child({ label: ["CheckPhoneNumberStatus", phoneNumber] })
			.warn(
				`Twilio line type intelligence responded with error code: ${lineTypeError}`,
				{
					PhoneNumber: phoneNumber,
					TwilioErrorCode: lineTypeError,
					TwilioLookup: lookup.toJSON(),
				},
			);
	}
	const phoneType: string = lookup.lineTypeIntelligence
		?.type as unknown as string;
	const allowedValues = ["mobile", "nonFixedVoip", "fixedVoip", "personal"];
	if (phoneType != null && !allowedValues.includes(phoneType)) {
		return {
			Name: "Phone Number",
			Status: "INVALID",
			Reason: `Twilio lookup reported this number as type '${phoneType}' which is outside the allowed types of phone numbers: ${JSON.stringify(allowedValues)}`,
		};
	}
	return {
		Name: "Phone Number",
		Status: "VALID",
	};
}
