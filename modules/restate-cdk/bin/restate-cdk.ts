#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { Web2TextServiceStack } from '../lib/web2text-service-stack';
import { RestateServerStack } from '../lib/restate-server-stack';
import { TwilioProxyStack } from '../lib/twilio-proxy-stack';

if (!["development", "production"].includes(process.env.DEPLOY_ENV?.toLowerCase() as string)) {
  throw new Error(`DEPLOY_ENV must be either "development" or "production", but got ${process.env.DEPLOY_ENV}`);
}
export const DEPLOYMENT_ENV: "development" | "production" = process.env.DEPLOY_ENV?.toLowerCase() as "development" | "production";
export const DEPLOYMENT_ENV_SUFFIX = DEPLOYMENT_ENV === "development" ? "DEV" : "PROD";

const app = new cdk.App();
const restateServerStack = new RestateServerStack(app, `RestateServerStack-${DEPLOYMENT_ENV_SUFFIX}`, {
  vpcId: "vpc-086692d4081db1b6f",
  env: { account: "202061849983", region: "us-east-1" },
  description: `Web2Text ${DEPLOYMENT_ENV} Restate server`,
});
const twilioProxyStack = new TwilioProxyStack(app, `TwilioProxyStack-${DEPLOYMENT_ENV_SUFFIX}`, {
  vpcId: "vpc-086692d4081db1b6f",
  env: { account: "202061849983", region: "us-east-1" },
  description: `Web2Text ${DEPLOYMENT_ENV} Twilio proxy`,
});
const web2TextServiceStack = new Web2TextServiceStack(app, `Web2TextServiceStack-${DEPLOYMENT_ENV_SUFFIX}`, {
  vpcId: "vpc-086692d4081db1b6f",
  env: { account: "202061849983", region: "us-east-1" },
  description: `Web2Text ${DEPLOYMENT_ENV} service`,
  twilioProxyUrl: twilioProxyStack.twilioProxyUrl.url,
  restateServer: restateServerStack.restateServer,
  serviceDeployer: restateServerStack.restateServiceDeployer,
});

web2TextServiceStack.addDependency(restateServerStack);
web2TextServiceStack.addDependency(twilioProxyStack);