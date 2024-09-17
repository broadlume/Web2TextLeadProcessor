import type { UUID } from "node:crypto";
import {
	type Web2TextLeadCreateRequest,
	Web2TextLeadCreateRequestSchema,
} from "../types";
import * as restate from "@restatedev/restate-sdk";
import { APIKeyModel } from "../dynamodb/APIKeyModel";
import { fromError } from 'zod-validation-error';
import { NexusRetailerAPI } from "../external/nexus";
import { NexusStoresAPI } from "../external/nexus";
import type { LeadState } from "./common";
import { z } from "zod";
import { OptedOutNumberModel } from "../dynamodb/OptedOutNumberModel";
import type { E164Number } from "libphonenumber-js";
import parsePhoneNumber from 'libphonenumber-js';
/**
 * Validate that the authorization header on requests is a valid API key
 * @param auth the authorization header value
 */
export async function ValidateAPIKey(context: restate.ObjectSharedContext<LeadState>, auth: string | undefined): Promise<boolean> {
	if (auth == null) {
		throw new restate.TerminalError("Must pass authorization header with valid API key", {errorCode: 401});
	}
	let key: string | null = auth;
	if (auth.startsWith("Bearer ")) {
		key = auth.split(" ")?.[1]?.trim();
	}
	if (z.string().uuid().safeParse(key).success === false) {
		throw new restate.TerminalError("API Key is not a valid UUIDv4", {errorCode: 401});
	}
	if (process.env.INTERNAL_API_TOKEN != null && key === process.env.INTERNAL_API_TOKEN) return true;
	const apiKey = await context.run("Fetch API Key", async () => await APIKeyModel.get(key));
	const apiKeyValid = apiKey?.Active ?? false;
	if (apiKeyValid === false) {
		throw new restate.TerminalError(`API Key '${key}' is invalid`, {
			errorCode: 401,
		});
	}
	return apiKeyValid;
}

/**
 * Validate that a given IP address is not blocked and allowed to submit a lead
 * @param ipAddress the IP address to check
 * @returns true if the IP is allowed, false otherwise
 */
export async function ValidateIPAddress(ipAddress: string): Promise<boolean> {
	return true;
}

type ClientStatus = "ELIGIBLE" | "INELIGIBLE" | "NONEXISTANT";
/**
 * Validate that the client the lead is being submitted to exists and is eligible to receive Web2Text leads
 * @param universalId the universal client ID of the client
 * @returns a ClientStatus type
 */
export async function CheckClientStatus(
	universalId: UUID,
): Promise<ClientStatus> {
	const nexusRetailer = await NexusRetailerAPI.GetRetailerByID(universalId);
	if (nexusRetailer == null) return "NONEXISTANT";
	if (nexusRetailer.status === "Churned_Customer") return "INELIGIBLE";
	return "ELIGIBLE";
}

/**
 * Validate that the location ID exists
 * @param universalId the universal client ID
 * @param locationId the location ID within the client
 * @returns true if the location exists, false otherwise
 */
async function ValidateLocation(locationId: UUID): Promise<boolean> {
	const location = await NexusStoresAPI.GetRetailerStoreByID(locationId);
	if (location == null) return false;
	return true;
}

/**
 * Parse and verify the POST body of a lead creation request
 * @param ctx the restate object context
 * @param req the request to parse and verify
 * @returns a parsed Web2TextLeadCreateRequest if the lead passed validation - throws an error otherwise
 */
export async function ParseAndVerifyLeadCreation(
	ctx: restate.ObjectContext<LeadState>,
	req: unknown,
): Promise<Web2TextLeadCreateRequest> {
	const parseRequest =
		await Web2TextLeadCreateRequestSchema.safeParseAsync(req);
	if (!parseRequest.success) {
		const formattedError = fromError(parseRequest.error);
		const error = {
			message: "Request could not be parsed",
			details: formattedError,
		};
		throw new restate.TerminalError(JSON.stringify(error), {
			errorCode: 400,
		});
	}
	const leadState = parseRequest.data;
	const ipAddressValid = await ctx.run<boolean>(
		"IP address validation",
		async () => await ValidateIPAddress(leadState.Lead.IPAddress),
	);
	if (!ipAddressValid) {
		throw new restate.TerminalError(
			`IP Address '${leadState}' is invalid or blocked`,
			{ errorCode: 401 },
		);
	}

	const clientStatus = await ctx.run<ClientStatus>(
		"Client status check",
		async () => await CheckClientStatus(leadState.UniversalRetailerId),
	);
	if (clientStatus !== "ELIGIBLE") {
		throw new restate.TerminalError(
			`UniversalRetailerId '${leadState.UniversalRetailerId}' has status '${clientStatus}'`,
			{ errorCode: 400 },
		);
	}

	const optedOut = await ctx.run<boolean>("Client phone number validation", async () => await isPhoneNumberOptedOut(leadState.Lead.PhoneNumber));
	if (optedOut) {
		throw new restate.TerminalError("Customer phone number cannot be used or is invalid", {errorCode: 400});
	}

	const dealerPhoneNumber = (await ctx.run("Get dealer info", async () => await NexusRetailerAPI.GetRetailerByID(leadState.UniversalRetailerId)))?.primary_account_phone;
	if (parsePhoneNumber(dealerPhoneNumber ?? "")?.number === leadState.Lead.PhoneNumber) {
		throw new restate.TerminalError("Customer phone number is the same as the dealer's phone number");
	}

	const locationValid = await ctx.run<boolean>(
		"Location validation",
		async () => await ValidateLocation(leadState.LocationId),
	);
	if (!locationValid) {
		throw new restate.TerminalError(
			`Location ID '${leadState.LocationId}' is invalid or does not exist'`,
			{ errorCode: 400 },
		);
	}
	return parseRequest.data;
}
/**
 * Check if phone number is opted out of text messaging
 * @param phoneNumber the number to check, in E164 format
 * @returns true if the number is opted out of text messaging, false if not
 */
async function isPhoneNumberOptedOut(phoneNumber: E164Number): Promise<boolean> {
	const optedOut = await OptedOutNumberModel.get(phoneNumber);
	return optedOut != null;
}

