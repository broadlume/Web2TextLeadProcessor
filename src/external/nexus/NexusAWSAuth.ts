import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import ky from "ky";

/**
 * AWS Secret Manager secret that has the AWS Cognito auth information for Nexus API
 */
const secretName = "blx-shell-user-pool-stack-blx-api-client-secrets-dev-v1";
/**
 * Cached auth token so we don't have to
 * fetch a new one from AWS every time we do a Nexus API call
 */
let CachedAuthToken: string | null = null;
/**
 * Retrieve the AWS Cognito Auth token needed to authorize ourselves to Neuxs
 * @param refresh whether to force refresh the token in case the cached one has expired
 * @returns 
 */
export async function GetNexusAWSAuthToken(refresh: boolean = false): Promise<string> {
    if (!refresh && CachedAuthToken) {
        return CachedAuthToken;
    }
    console.log(process.env.AWS_ACCESS_KEY_ID);
    console.log(process.env.AWS_SECRET_ACCESS_KEY)
    const client = new SecretsManagerClient({
        region: "us-east-1",
        "credentials": {
            "accessKeyId": process.env.VIZ_AWS_ACCESS_KEY_ID,
            "secretAccessKey": process.env.VIZ_AWS_SECRET_ACCESS_KEY
        }
    });
    const response = await client.send(new GetSecretValueCommand({
        "SecretId": secretName,
        VersionStage: 'AWSCURRENT'
    }));

    const secret: {
        userPoolDomainName: string,
        userPoolRegion: string,
        clientId: string,
        clientSecret: string
    } = JSON.parse(response.SecretString!);

    const form = new URLSearchParams();
    form.append('grant_type', 'client_credentials');
    form.append('client_id', secret['clientId']);
    form.append('client_secret', secret['clientSecret']);

    const endpoint = `https://${secret['userPoolDomainName']}.auth.${secret['userPoolRegion']}.amazoncognito.com/oauth2/token`;

    const authResponse = await ky.post(endpoint, {
        body: form
    }).json<{access_token: string}>();
    
    CachedAuthToken = authResponse.access_token;
    return CachedAuthToken;

}