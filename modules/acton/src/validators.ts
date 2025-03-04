import * as restate from "@restatedev/restate-sdk";
import { z } from "zod";
import { APIKeyModel } from "../../acton/src/dynamodb/APIKeyModel";
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
