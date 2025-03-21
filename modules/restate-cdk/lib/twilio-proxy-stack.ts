import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambda_nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as logs from 'aws-cdk-lib/aws-logs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';
import { DEPLOYMENT_ENV, DEPLOYMENT_ENV_SUFFIX } from '../bin/restate-cdk';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

interface TwilioProxyStackProps extends cdk.StackProps {
    vpcId: string;
}

export class TwilioProxyStack extends cdk.Stack {
    public readonly twilioProxyUrl: lambda.FunctionUrl;
    constructor(scope: Construct, id: string, props: TwilioProxyStackProps) {
        super(scope, id, props);
        const vpc = ec2.Vpc.fromLookup(this, "Vpc", { vpcId: props.vpcId });
        let ENVIRONMENT_VARIABLES: Record<string, string> = {};

        if (DEPLOYMENT_ENV === 'development') {
            ENVIRONMENT_VARIABLES = dotenv.parse(fs.readFileSync(path.resolve(__dirname, '../env/twilio-proxy/.env.dev')));
        } else if (DEPLOYMENT_ENV === 'production') {
            ENVIRONMENT_VARIABLES = dotenv.parse(fs.readFileSync(path.resolve(__dirname, '../env/twilio-proxy/.env.prod')));
        }
        const twilioProxy = new lambda_nodejs.NodejsFunction(this, `TwilioProxy-${DEPLOYMENT_ENV_SUFFIX}`, {
            runtime: lambda.Runtime.NODEJS_22_X,
            functionName: `TwilioProxy-${DEPLOYMENT_ENV_SUFFIX}`,
            entry: "../twilio_proxy/index.ts",
            architecture: lambda.Architecture.ARM_64,
            timeout: cdk.Duration.minutes(5),
            depsLockFilePath: "../../bun.lockb",
            bundling: {
                minify: true,
                sourceMap: true,
                sourceMapMode: lambda_nodejs.SourceMapMode.INLINE,
            },
            environment: {
                ...ENVIRONMENT_VARIABLES,
                DEPLOYMENT_ENV: DEPLOYMENT_ENV,
                NODE_OPTIONS: "--enable-source-maps",
            },
            logGroup: new logs.LogGroup(this, `TwilioProxyLogs-${DEPLOYMENT_ENV_SUFFIX}`, {
                logGroupName: `/web2text-${DEPLOYMENT_ENV_SUFFIX.toLowerCase()}/twilio-proxy-logs`,
                retention: logs.RetentionDays.ONE_MONTH,
                removalPolicy: cdk.RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE,
            }),
            vpc,
            memorySize: 512,
        });
        this.twilioProxyUrl = twilioProxy.addFunctionUrl({
            authType: lambda.FunctionUrlAuthType.NONE,
        });
        new cdk.CfnOutput(this, "twilioProxyUrl", { value: this.twilioProxyUrl.url });
    }
}
