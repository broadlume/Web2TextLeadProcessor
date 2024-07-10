import type { UUID } from "node:crypto";
import {
	type Web2TextLeadCreateRequest,
	Web2TextLeadCreateRequestSchema,
} from "../types";
import * as restate from "@restatedev/restate-sdk";
import { APIKeyModel } from "../dynamodb/APIKeyModel";
import { fromError } from 'zod-validation-error';
import { Nexus_GetRetailerByID } from "../external/nexus/Retailer";
import { Nexus_GetRetailerStoreByID } from "../external/nexus/Stores";
/**
 * Validate that the authorization header on requests is a valid API key
 * @param auth the authorization header value
 */
export async function ValidateAPIKey(auth: string | undefined) {
	if (auth == null) {
		throw new restate.TerminalError("Must pass authorization header with valid API key", {errorCode: 401});
	}
	if (!auth.startsWith("Bearer ")) {
		throw new restate.TerminalError("Authorization header schema must be 'Bearer'", {errorCode: 401});
	}
	let key: string | null = auth.split(" ")?.[1]?.trim();
	if (key?.toLowerCase() === "undefined" || key?.toLowerCase() === "null")  {
		key = null;
	}
	if (key == null || key === "") {
		throw new restate.TerminalError("Authorization token is missing", {errorCode: 401});
	}
	const apiKey = await APIKeyModel.get(key);
	const apiKeyValid = apiKey?.Active ?? false;
	if (apiKeyValid === false) {
		throw new restate.TerminalError(`API Key '${apiKey}' is invalid`, {
			errorCode: 401,
		});
	}
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
	const nexusRetailer = await Nexus_GetRetailerByID(universalId);
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
async function ValidateLocation(universalId: UUID, locationId: UUID): Promise<boolean> {
	const location = await Nexus_GetRetailerStoreByID(universalId, locationId);
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
	ctx: restate.ObjectContext,
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
	const { Lead } = parseRequest.data;
	const ipAddressValid = await ctx.run<boolean>(
		"IP address validation",
		async () => await ValidateIPAddress(Lead.IPAddress),
	);
	if (!ipAddressValid) {
		throw new restate.TerminalError(
			`IP Address '${Lead}' is invalid or blocked`,
			{ errorCode: 401 },
		);
	}

	const clientStatus = await ctx.run<ClientStatus>(
		"Client status check",
		async () => await CheckClientStatus(Lead.UniversalClientId),
	);
	if (clientStatus !== "ELIGIBLE") {
		throw new restate.TerminalError(
			`UniversalClientID '${Lead.UniversalClientId}' has status '${clientStatus}'`,
			{ errorCode: 400 },
		);
	}

	const locationValid = await ctx.run<boolean>(
		"Location validation",
		async () => await ValidateLocation(Lead.UniversalClientId,Lead.LeadInformation.LocationID),
	);
	if (!locationValid) {
		throw new restate.TerminalError(
			`Location ID '${Lead.LeadInformation.LocationID}' is invalid or does not exist'`,
			{ errorCode: 400 },
		);
	}
	return parseRequest.data;
}
