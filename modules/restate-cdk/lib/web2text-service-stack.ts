import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as restate from '@restatedev/restate-cdk';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambda_nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { DEPLOYMENT_ENV, DEPLOYMENT_ENV_SUFFIX } from '../bin/restate-cdk';
import { randomUUID } from 'crypto';


interface Web2TextServiceStackProps extends cdk.StackProps {
  twilioProxyUrl: string;
  restateServer: restate.SingleNodeRestateDeployment;
  serviceDeployer: restate.ServiceDeployer;
  vpcId: string;
  envVariables: Record<string, string>;

}

export class Web2TextServiceStack extends cdk.Stack {
  public static readonly SECRET_IDS = {
    "development": "web2text-dev-env",
    "production": "web2text-prod-env"
  };
  constructor(scope: Construct, id: string, props: Web2TextServiceStackProps) {
    super(scope, id, props);
    const vpc = ec2.Vpc.fromLookup(this, "Vpc", { vpcId: props.vpcId });
    const web2TextService = new lambda_nodejs.NodejsFunction(this, `Web2TextService-${DEPLOYMENT_ENV_SUFFIX}`, {
      runtime: lambda.Runtime.NODEJS_22_X,
      functionName: `Web2TextService-${DEPLOYMENT_ENV_SUFFIX}`,
      entry: "../web2text/src/lambda.ts",
      architecture: lambda.Architecture.ARM_64,
      depsLockFilePath: "../../bun.lockb",
      timeout: cdk.Duration.minutes(15),
      bundling: {
        minify: true,
        sourceMap: true,
        sourceMapMode: lambda_nodejs.SourceMapMode.INLINE,
      },
      environment: {
        ...props.envVariables,
        DEPLOYMENT_ENV: DEPLOYMENT_ENV,
        INTERNAL_API_TOKEN: randomUUID(),
        RESTATE_ADMIN_URL: props.restateServer.adminUrl,
        TWILIO_PROXY_URL: props.twilioProxyUrl,
        NODE_OPTIONS: "--enable-source-maps",
      },
      logGroup: new logs.LogGroup(this, `Web2TextServiceLogs-${DEPLOYMENT_ENV_SUFFIX}`, {
        logGroupName: `/web2text-${DEPLOYMENT_ENV_SUFFIX.toLowerCase()}/web2text-service-logs`,
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: cdk.RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE,
      }),
      // Retain the old version of the function when updating so old restate invocations still work
      currentVersionOptions: {
        removalPolicy: cdk.RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE,
      },
      memorySize: 1024,
      vpc,
    });

    web2TextService.addToRolePolicy(new iam.PolicyStatement({
      actions: ["dynamodb:*"],
      resources: ["*"],
    }));

    props.serviceDeployer.register(web2TextService.currentVersion, props.restateServer, {
      "adminUrl": props.restateServer.adminUrl,
      skipInvokeFunctionGrant: true,
    });
  }
}
