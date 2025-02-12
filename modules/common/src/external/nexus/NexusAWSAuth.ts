import {
	GetSecretValueCommand,
	SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import ky from "ky";
/**
 * Cached auth token so we don't have to
 * fetch a new one from AWS every time we do a Nexus API call
 */
let CachedAuthToken: {
	access_token: string;
	expires_in: number;
	token_type: "Bearer";
} | null = null;
/**
 * Retrieve the AWS Cognito Auth token needed to authorize ourselves to Neuxs
 * @param refresh whether to force refresh the token in case the cached one has expired

 */
export async function GetNexusAWSAuthToken(
	refresh: boolean = false,
): Promise<string> {
	console.log(process.env.NODE_ENV);
	if (process.env.NODE_ENV === "test") return "test-token";
	if (!refresh && CachedAuthToken) {
		return CachedAuthToken.access_token;
	}
	const client = new SecretsManagerClient({
		region: process.env.NEXUS_AUTH_AWS_REGION,
		credentials: {
			accessKeyId: process.env.NEXUS_AUTH_AWS_ACCESS_KEY_ID,
			secretAccessKey: process.env.NEXUS_AUTH_AWS_SECRET_ACCESS_KEY,
		},
	});
	const secretName = process.env.NEXUS_AWS_API_SECRET_NAME!;
	const response = await client.send(
		new GetSecretValueCommand({
			SecretId: secretName,
			VersionStage: "AWSCURRENT",
		}),
	);

	const secret: {
		userPoolDomainName: string;
		userPoolRegion: string;
		clientId: string;
		clientSecret: string;
	} = JSON.parse(response.SecretString!);

	const form = new URLSearchParams();
	form.append("grant_type", "client_credentials");
	form.append("client_id", secret["clientId"]);
	form.append("client_secret", secret["clientSecret"]);

	const endpoint = `https://${secret["userPoolDomainName"]}.auth.${secret["userPoolRegion"]}.amazoncognito.com/oauth2/token`;

	const authResponse = await ky
		.post(endpoint, {
			body: form,
		})
		.json<NonNullable<typeof CachedAuthToken>>();
	CachedAuthToken = authResponse;
	return CachedAuthToken.access_token;
}
