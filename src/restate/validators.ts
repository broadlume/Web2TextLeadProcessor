import type { UUID } from "node:crypto";
import {
	type Web2TextLeadCreateRequest,
	Web2TextLeadCreateRequestSchema,
} from "../types";
import * as restate from "@restatedev/restate-sdk";
import { APIKeyModel } from "../dynamodb/APIKeyModel";
import { fromError } from 'zod-validation-error';
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

export async function ValidateIPAddress(ipAddress: string): Promise<boolean> {
	return true;
}

type ClientStatus = "ELIGIBLE" | "INELIGIBLE" | "NONEXISTANT";
export async function CheckClientStatus(
	universalId: UUID,
): Promise<ClientStatus> {
	return "ELIGIBLE";
}

async function ValidateLocation(location: {
	Name?: string;
	LocationID: UUID;
}): Promise<boolean> {
	return true;
}

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
