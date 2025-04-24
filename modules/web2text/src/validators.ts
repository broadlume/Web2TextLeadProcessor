import type { UUID } from "node:crypto";
import * as restate from "@restatedev/restate-sdk";
import { logger } from "common";
import { NexusRetailerAPI } from "common/external/nexus";
import { NexusStoresAPI } from "common/external/nexus";
import { TwilioLookupAPI } from "common/external/twilio";
import type { E164Number } from "libphonenumber-js";
import parsePhoneNumber from "libphonenumber-js";
import type { Twilio } from "twilio";
import { OptedOutNumberModel } from "./dynamodb/OptedOutNumberModel";
import type { Web2TextLeadCreateRequest } from "./restate/services/Lead/Web2TextLeadCreateRequest";
import type {
	LeadState,
	Web2TextLead
} from "./types";
export type ValidationStatus = {
	Status: "VALID" | "INVALID" | "NONEXISTANT";
	Reason?: string;
};
/**
 * Validate that a given IP address is not blocked and allowed to submit a lead
 * @param ipAddress the IP address to check
 * @returns true if the IP is allowed, false otherwise
 */
export async function CheckIpAddressStatus(
	ipAddress: string,
): Promise<ValidationStatus> {
	return { Status: "VALID" };
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
			Status: "NONEXISTANT",
			Reason: "Could not find client with this UniversalRetailerId in Nexus",
		};
	if (nexusRetailer.status === "Churned_Customer")
		return {
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
		return { Status: "INVALID", Reason: "Retailer is opted out of Web2Text" };
	}
	return { Status: "VALID" };
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
			Status: "NONEXISTANT",
			Reason: "Could not find location with this Id in Nexus",
		};
	if (
		location.Web2Text_Phone_Number == null ||
		location.Web2Text_Phone_Number.trim() === ""
	) {
		return {
			Status: "INVALID",
			Reason:
				"Location does not have a Web2Text phone number associated in Nexus",
		};
	}
	const locationPhone = parsePhoneNumber(location.Web2Text_Phone_Number, "US");
	if (locationPhone == null) {
		return {
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
			Status: "NONEXISTANT",
			Reason: "Phone number is missing",
		};
	}
	const optedOut = await IsPhoneNumberOptedOut(phoneNumber);
	if (optedOut) {
		return {
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
			Status: "INVALID",
			Reason: `Twilio lookup reported this number as invalid - [${lookup.validationErrors.join(", ")}]`,
		};
	}
	const lineTypeError: number | null = lookup.lineTypeIntelligence?.error_code as unknown as number | null;
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
	const phoneType: string = lookup.lineTypeIntelligence?.type as unknown as string;
	const allowedValues = ["mobile", "nonFixedVoip", "fixedVoip", "personal"];
	if (phoneType != null && !allowedValues.includes(phoneType)) {
		return {
			Status: "INVALID",
			Reason: `Twilio lookup reported this number as type '${phoneType}' which is outside the allowed types of phone numbers: ${JSON.stringify(allowedValues)}`,
		};
	}
	return {
		Status: "VALID",
	};
}

/**
 * Parse and verify the POST body of a lead creation request
 * @param ctx the restate object context
 * @param req the request to parse and verify
 * @returns a parsed Web2TextLeadCreateRequest if the lead passed validation - throws an error otherwise
 */
export async function VerifyLeadSubmission(
	ctx: restate.ObjectContext<LeadState<Web2TextLead>>,
	req: Web2TextLeadCreateRequest,
) {
	const leadState = req;
	if (leadState.Lead.IPAddress != null) {
		const ipAddressValid = await ctx.run<ValidationStatus>(
			"IP address validation",
			async () => await CheckIpAddressStatus(leadState.Lead.IPAddress!),
		);
		if (ipAddressValid.Status !== "VALID") {
			throw new restate.TerminalError(
				`IP Address is '${ipAddressValid.Status}' - ${ipAddressValid.Reason}`.trim(),
				{ errorCode: 401 },
			);
		}
	}
	const clientStatus = await ctx.run<ValidationStatus>(
		"Client status check",
		async () => await CheckClientStatus(leadState.UniversalRetailerId),
	);
	if (clientStatus.Status !== "VALID") {
		throw new restate.TerminalError(
			`UniversalRetailerId is '${clientStatus.Status}' - ${clientStatus.Reason}`.trim(),
			{ errorCode: 400 },
		);
	}

	const locationStatus = await ctx.run<ValidationStatus>(
		"Location validation",
		async () => await CheckLocationStatus(leadState.Lead.LocationId),
	);
	if (locationStatus.Status !== "VALID") {
		throw new restate.TerminalError(
			`Location ID is '${locationStatus.Status}' - ${locationStatus.Reason}`.trim(),
			{ errorCode: 400 },
		);
	}
	const storePhoneNumber = parsePhoneNumber(
		(
			await ctx.run(
				"Get store phone number",
				async () =>
					await NexusStoresAPI.GetRetailerStoreByID(leadState.Lead.LocationId),
			)
		)?.Web2Text_Phone_Number ?? "",
		"US",
	);

	if (storePhoneNumber?.number === leadState.Lead.PhoneNumber) {
		throw new restate.TerminalError(
			"Customer phone number is the same as the store's phone number",
			{ errorCode: 400 },
		);
	}

	const customerPhoneStatus = await ctx.run(
		"Customer phone validation",
		async () =>
			await CheckPhoneNumberStatus(
				globalThis.TWILIO_CLIENT,
				leadState.Lead.PhoneNumber,
			),
	);
	if (customerPhoneStatus.Status !== "VALID") {
		throw new restate.TerminalError(
			`Customer phone number has status '${customerPhoneStatus.Status}' - ${customerPhoneStatus.Reason}`.trim(),
			{
				errorCode: 400,
			},
		);
	}
}
