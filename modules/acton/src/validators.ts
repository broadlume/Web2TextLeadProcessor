import type { UUID } from "node:crypto";
import * as restate from "@restatedev/restate-sdk";
import { logger } from "common";
import { NexusRetailerAPI } from "common/external/nexus";
import { NexusStoresAPI } from "common/external/nexus";
import { TwilioLookupAPI } from "common/external/twilio";
import type { E164Number } from "libphonenumber-js";
import parsePhoneNumber from "libphonenumber-js";
import type { Twilio } from "twilio";
import { z } from "zod";
import { fromError } from "zod-validation-error";
import { APIKeyModel } from "../../acton/src/dynamodb/APIKeyModel";
import { Web2TextLeadCreateRequestSchema } from "../../web2text/src/types";
import type { LeadState, WebFormLeadCreateRequestSchema } from "../src/types";
export type ValidationStatus = {
	Status: "VALID" | "INVALID" | "NONEXISTANT";
	Reason?: string;
};

/**
 * Validate that the authorization header on requests is a valid API key
 * @param auth the authorization header value
 */
export async function CheckAPIKeyStatus(
	endpoint: string,
	auth: string | undefined,
): Promise<ValidationStatus> {
	if (auth == null) {
		return {
			Status: "NONEXISTANT",
			Reason: "Must pass authorization header with valid API key",
		};
	}
	let key: string | null = auth;
	if (auth.startsWith("Bearer ")) {
		key = auth.split(" ")?.[1]?.trim();
	}
	if (z.string().uuid().safeParse(key).success === false) {
		return { Status: "INVALID", Reason: "API Key is not a valid UUIDv4" };
	}
	if (
		process.env.INTERNAL_API_TOKEN != null &&
		key === process.env.INTERNAL_API_TOKEN
	) {
		return { Status: "VALID" };
	}

	const apiKey = await APIKeyModel.get(key);
	const apiKeyValid = apiKey?.Active ?? false;
	if (apiKeyValid === false) {
		return {
			Status: "INVALID",
			Reason: "API Key doesn't exist or has been marked inactive",
		};
	}
	if (
		apiKey.AuthorizedEndpoints.includes("*") ||
		apiKey.AuthorizedEndpoints.includes(endpoint)
	)
		return { Status: "VALID" };
	return {
		Status: "INVALID",
		Reason: `API Key does not have authorization for '${endpoint}'`,
	};
}

export async function CheckAuthorization(
	ctx: restate.Context,
	endpoint: string,
	auth: string | undefined,
) {
	const result = await ctx.run(
		"Verify API Key",
		async () => await CheckAPIKeyStatus(endpoint, auth),
	);
	if (result.Status !== "VALID") {
		const request = ctx.request();
		let key: string | undefined = undefined;
		try {
			key = "key" in ctx ? (ctx.key as string) : undefined;
		} catch (e) {
			// ignore
		}
		ctx.console.warn(`API Key failed validation for endpoint '${endpoint}'`, {
			_meta: 1,
			label: key,
			APIKey: auth,
			Endpoint: endpoint,
			Status: result.Status,
			Reason: result.Reason,
			Request: request,
		});
		throw new restate.TerminalError(result.Reason ?? "", {
			errorCode: 401,
		});
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
		throw new restate.TerminalError(
			`Request could not be parsed - ${formattedError.message}`,
			{
				errorCode: 400,
			},
		);
	}
	const leadState = parseRequest.data;
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
		async () => await CheckLocationStatus(leadState.LocationId),
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
					await NexusStoresAPI.GetRetailerStoreByID(leadState.LocationId),
			)
		)?.Web2Text_Phone_Number ?? "",
		"US",
	);

	if (storePhoneNumber?.number === leadState.Lead.PhoneNumber) {
		throw new restate.TerminalError(
			"Customer phone number is the same as the store's phone number",
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
	return parseRequest.data;
}
