export * as ActOnListAPI from "./ActOnListAPI";
type ActOnTokenResponse = {
	access_token: string;
	refresh_token: string;
	scope: string;
	token_type: string;
	expires_in: number;
};

export const ACTON_AUTHORIZE_HEADERS = async () => {
	const headers = new Headers();
	const accessToken = await GetActOnAccessToken();
	headers.set("Authorization", `Bearer ${accessToken}`);
	headers.set("Accept", "application/json");
	return headers;
};

const GetActOnAccessToken = async (): Promise<string> => {
	const actonUrl = new URL(process.env.ACTON_BASE_URL);
	actonUrl.pathname += "token";
	const headers = new Headers();
	headers.set("Content-Type", "application/x-www-form-urlencoded");

	const body = {
		grant_type: "password",
		username: process.env.ACTON_USERNAME,
		password: process.env.ACTON_PASSWORD,
		client_id: process.env.ACTON_CLIENT_ID,
		client_secret: process.env.ACTON_CLIENT_SECRET,
	};

	const urlEncodedData = new URLSearchParams(
		body as Record<string, string>,
	).toString();

	const response = await fetch(actonUrl.toString(), {
		method: "POST",
		headers: headers,
		body: urlEncodedData,
	});
	if (response?.ok) {
		const data = (await response.json()) as ActOnTokenResponse;
		return data.access_token;
	}
	throw new Error("Failed to get ActOn access token");
};
