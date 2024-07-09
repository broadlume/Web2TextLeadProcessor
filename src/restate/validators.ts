import type { UUID } from "node:crypto";
import { type Web2TextLeadCreateRequest, Web2TextLeadCreateRequestSchema } from "../types";
import * as restate from '@restatedev/restate-sdk';
import { APIKeyModel } from "../dynamodb/APIKeyModel";
export async function ValidateAPIKey(key: UUID): Promise<boolean> {
	console.log(key);
	const apiKey = await APIKeyModel.get(key);
    if (apiKey == null) return false;
    return apiKey.Active;
}

export async function ValidateIPAddress(ipAddress: string): Promise<boolean> {
	return true;
}

type ClientStatus = "ELIGIBLE" | "INELIGIBLE" | "NONEXISTANT";
export async function CheckClientStatus(universalId: UUID): Promise<ClientStatus> {
	return "ELIGIBLE";
}

async function ValidateLocation(location: {
	Name?: string;
	LocationID: UUID;
}): Promise<boolean> {
	return true;
}

export async function ParseAndVerify(
	ctx: restate.ObjectContext,
	req: unknown,
): Promise<Web2TextLeadCreateRequest> {
	const parseRequest = await Web2TextLeadCreateRequestSchema.safeParseAsync(req);
	if (!parseRequest.success) {
		const formattedError = parseRequest.error.format();
		const error = {
			message: "Request could not be parsed",
			details: formattedError,
		};
		throw new restate.TerminalError(JSON.stringify(error), {
			errorCode: 400,
		});
	}
	const { APIKey, Lead } = parseRequest.data;
	const apiKeyValid = await ctx.run<boolean>(
		"API key validation",
		async () => await ValidateAPIKey(APIKey),
	);
	if (!apiKeyValid) {
		throw new restate.TerminalError(`API Key '${APIKey}' is invalid`, {
			errorCode: 401,
		});
	}
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
		async () => await ValidateLocation(Lead.LeadInformation),
	);
	if (!locationValid) {
		throw new restate.TerminalError(
			`LeadInformation.Location {Name: '${Lead.LeadInformation.LocationName}', LocationID: '${Lead.LeadInformation.LocationID}'} is invalid or does not exist'`,
			{ errorCode: 400 },
		);
	}
	return parseRequest.data;
}