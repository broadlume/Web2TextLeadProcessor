#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { LeadServiceStack } from '../lib/lead-service-stack';
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
  description: `LeadService ${DEPLOYMENT_ENV} Restate server`,
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
  description: `LeadService ${DEPLOYMENT_ENV} Twilio proxy`,
  envVariables: twilioProxyEnvVariables
});

console.log("Fetching lead service secrets");
const leadServiceSecret = await client.send(
  new GetSecretValueCommand({
    SecretId: LeadServiceStack.SECRET_IDS[DEPLOYMENT_ENV],
  }),
);

const leadServiceEnvVariables = JSON.parse(leadServiceSecret.SecretString as string);
const leadServiceStack = new LeadServiceStack(app, `LeadServiceStack-${DEPLOYMENT_ENV_SUFFIX}`, {
  vpcId: VPC_IDS[DEPLOYMENT_ENV],
  env: { account: "202061849983", region: "us-east-1" },
  description: `LeadService ${DEPLOYMENT_ENV} service`,
  twilioProxyUrl: twilioProxyStack.twilioProxyUrl.url,
  restateServer: restateServerStack.restateServer,
  serviceDeployer: restateServerStack.restateServiceDeployer,
  envVariables: leadServiceEnvVariables
});

leadServiceStack.addDependency(restateServerStack);
leadServiceStack.addDependency(twilioProxyStack);
}
main();