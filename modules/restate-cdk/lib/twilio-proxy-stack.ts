import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambda_nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as logs from 'aws-cdk-lib/aws-logs';
import { DEPLOYMENT_ENV, DEPLOYMENT_ENV_SUFFIX } from '../bin/restate-cdk';
interface TwilioProxyStackProps extends cdk.StackProps {
    vpcId: string;
    envVariables: Record<string, string>;
}


export class TwilioProxyStack extends cdk.Stack {
    public readonly twilioProxyUrl: lambda.FunctionUrl;
    public static readonly SECRET_IDS = {
        "development": "twilio-proxy-dev-env",
        "production": "twilio-proxy-prod-env"
    };
    constructor(scope: Construct, id: string, props: TwilioProxyStackProps) {
        super(scope, id, props);
        const vpc = ec2.Vpc.fromLookup(this, "Vpc", { vpcId: props.vpcId });

        const twilioProxy = new lambda_nodejs.NodejsFunction(this, `TwilioProxy-${DEPLOYMENT_ENV_SUFFIX}`, {
            runtime: lambda.Runtime.NODEJS_22_X,
            functionName: `TwilioProxy-${DEPLOYMENT_ENV_SUFFIX}`,
            entry: "../twilio_proxy/lambda.ts",
            architecture: lambda.Architecture.ARM_64,
            timeout: cdk.Duration.minutes(5),
            depsLockFilePath: "../twilio_proxy/bun.lockb",
            bundling: {
                minify: true,
                sourceMap: true,
                sourceMapMode: lambda_nodejs.SourceMapMode.INLINE,
                keepNames: true
            },
            environment: {
                ...props.envVariables,
                DEPLOYMENT_ENV: DEPLOYMENT_ENV,
                NODE_OPTIONS: "--enable-source-maps",
            },
            logGroup: new logs.LogGroup(this, `TwilioProxyLogs-${DEPLOYMENT_ENV_SUFFIX}`, {
                logGroupName: `/lead-service/${DEPLOYMENT_ENV_SUFFIX.toLowerCase()}/twilio-proxy`,
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
