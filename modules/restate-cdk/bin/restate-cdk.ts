#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { Web2TextServiceStack } from '../lib/web2text-service-stack';
import { RestateServerStack } from '../lib/restate-server-stack';
import { TwilioProxyStack } from '../lib/twilio-proxy-stack';
import { ACM_CERTIFICATE_ARNS, NLB_SUBNET_IDS, VPC_IDS } from './constants';
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";

if (!["development", "production"].includes(process.env.DEPLOY_ENV?.toLowerCase() as string)) {
  throw new Error(`DEPLOY_ENV must be either "development" or "production", but got ${process.env.DEPLOY_ENV}`);
}
export const DEPLOYMENT_ENV: "development" | "production" = process.env.DEPLOY_ENV?.toLowerCase() as "development" | "production";
export const DEPLOYMENT_ENV_SUFFIX = DEPLOYMENT_ENV === "development" ? "DEV" : "PROD";

async function main() {
const app = new cdk.App();
const client = new SecretsManagerClient({
  profile: "default",
  region: "us-east-1",
});
const restateServerStack = new RestateServerStack(app, `RestateServerStack-${DEPLOYMENT_ENV_SUFFIX}`, {
  vpcId: VPC_IDS[DEPLOYMENT_ENV],
  nlbSubnetIds: NLB_SUBNET_IDS[DEPLOYMENT_ENV],
  acmCertificateArn: ACM_CERTIFICATE_ARNS[DEPLOYMENT_ENV],
  env: { account: "202061849983", region: "us-east-1" },
  description: `Web2Text ${DEPLOYMENT_ENV} Restate server`,
  envVariables: {}
});

console.log("Fetching twilio proxy secrets");
const twilioProxySecret = await client.send(
  new GetSecretValueCommand({
    SecretId: TwilioProxyStack.SECRET_IDS[DEPLOYMENT_ENV],
  }),
);

const twilioProxyEnvVariables = JSON.parse(twilioProxySecret.SecretString as string);
const twilioProxyStack = new TwilioProxyStack(app, `TwilioProxyStack-${DEPLOYMENT_ENV_SUFFIX}`, {
  vpcId: VPC_IDS[DEPLOYMENT_ENV],
  env: { account: "202061849983", region: "us-east-1" },
  description: `Web2Text ${DEPLOYMENT_ENV} Twilio proxy`,
  envVariables: twilioProxyEnvVariables
});

console.log("Fetching twilio proxy secrets");
const web2TextSecret = await client.send(
  new GetSecretValueCommand({
    SecretId: Web2TextServiceStack.SECRET_IDS[DEPLOYMENT_ENV],
  }),
);

const web2TextEnvVariables = JSON.parse(web2TextSecret.SecretString as string);
const web2TextServiceStack = new Web2TextServiceStack(app, `Web2TextServiceStack-${DEPLOYMENT_ENV_SUFFIX}`, {
  vpcId: VPC_IDS[DEPLOYMENT_ENV],
  env: { account: "202061849983", region: "us-east-1" },
  description: `Web2Text ${DEPLOYMENT_ENV} service`,
  twilioProxyUrl: twilioProxyStack.twilioProxyUrl.url,
  restateServer: restateServerStack.restateServer,
  serviceDeployer: restateServerStack.restateServiceDeployer,
  envVariables: web2TextEnvVariables
});

  web2TextServiceStack.addDependency(restateServerStack);
  web2TextServiceStack.addDependency(twilioProxyStack);
}
main();