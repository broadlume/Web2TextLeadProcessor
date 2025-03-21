import { DEPLOYMENT_ENV, DEPLOYMENT_ENV_SUFFIX } from '../bin/restate-cdk';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as restate from '@restatedev/restate-cdk';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { InstanceIdTarget } from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { getEniIpsByEniIds } from './util';
interface RestateServerStackProps extends cdk.StackProps {
    vpcId: string;
}

const ACM_CERTIFICATE_ARNS = {
    "development": "arn:aws:acm:us-east-1:202061849983:certificate/f18856c4-831f-41e0-927f-11f5410bfcdc",
    "staging": "arn:aws:acm:us-east-1:202061849983:certificate/47bd373d-637e-42ed-9677-ec0f8dbbd8fb",
    "production": "arn:aws:acm:us-east-1:202061849983:certificate/e96ebcf1-a25a-4427-8ac2-4e25df123872"
}
export class RestateServerStack extends cdk.Stack {
    public readonly restateServer: restate.SingleNodeRestateDeployment;
    public readonly restateServiceDeployer: restate.ServiceDeployer;
    public readonly vpc: ec2.IVpc;
    constructor(scope: Construct, id: string, props: RestateServerStackProps) {
        super(scope, id, props);
        this.vpc = ec2.Vpc.fromLookup(this, "Vpc", { vpcId: props.vpcId });
        const vpc = this.vpc;
        let ENVIRONMENT_VARIABLES: Record<string, string> = {};

        if (DEPLOYMENT_ENV === 'development') {
            ENVIRONMENT_VARIABLES = dotenv.parse(fs.readFileSync(path.resolve(__dirname, '../env/restate-server/.env.dev')));
        } else if (DEPLOYMENT_ENV === 'production') {
            ENVIRONMENT_VARIABLES = dotenv.parse(fs.readFileSync(path.resolve(__dirname, '../env/restate-server/.env.prod')));
        }
        // Create the restate server on an EC2 instance
        this.restateServer = new restate.SingleNodeRestateDeployment(this, `RestateServer-${DEPLOYMENT_ENV_SUFFIX}`, {
            publicIngress: true,
            networkConfiguration: {
                subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
            },
            environment: {
                ...ENVIRONMENT_VARIABLES
            },
            vpc,
            restateTag: "1.2.2",
            tracing: restate.TracingMode.AWS_XRAY,
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.LARGE),
            dataVolumeOptions: {
                "volumeSize": 128,
            },
            logGroup: new logs.LogGroup(this, `RestateLogs-${DEPLOYMENT_ENV_SUFFIX}`, {
                logGroupName: `/web2text-${DEPLOYMENT_ENV_SUFFIX.toLowerCase()}/restate-server-logs`,
                retention: logs.RetentionDays.ONE_MONTH,
                removalPolicy: cdk.RemovalPolicy.DESTROY,
            }),
        });
        // Set the EC2 instance name
        const loadBalancerSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(this, "RestateServerSecurityGroup", "sg-0125cec8ff948873f");
        cdk.Tags.of(this.restateServer.instance).add('Name', `Web2Text-RestateServer-${DEPLOYMENT_ENV_SUFFIX}`);
        const loadBalancer = new elbv2.NetworkLoadBalancer(this, `RestateLoadBalancer-${DEPLOYMENT_ENV_SUFFIX}`, {
            vpc,
            vpcSubnets: {
                subnets: [
                    ec2.Subnet.fromSubnetId(this, "Publicwebsites-dev1A", "subnet-0748be9bc387e9bed"),
                    ec2.Subnet.fromSubnetId(this, "Publicwebsites-dev1B", "subnet-0a97c28c458f887ee"),
                ]
            },
            securityGroups: [this.restateServer.adminSecurityGroup, loadBalancerSecurityGroup],
            internetFacing: true
        });

        // Create target groups for each port
        const targetGroup8080 = new elbv2.NetworkTargetGroup(this, `RestateTargetGroup8080-${DEPLOYMENT_ENV_SUFFIX}`, {
            vpc,
            port: 8080,
            protocol: elbv2.Protocol.TCP,
            targetType: elbv2.TargetType.INSTANCE,
            healthCheck: {
                enabled: true,
                port: '8080'
            }
        });
        const targetGroup9070 = new elbv2.NetworkTargetGroup(this, `RestateTargetGroup9070-${DEPLOYMENT_ENV_SUFFIX}`, {
            vpc,
            port: 9070,
            protocol: elbv2.Protocol.TCP,
            targetType: elbv2.TargetType.INSTANCE,
            healthCheck: {
                enabled: true,
                port: '9070'
            }
        });

        // Add the Restate server instance to each target group
        targetGroup8080.addTarget(new InstanceIdTarget(this.restateServer.instance.instanceId));
        targetGroup9070.addTarget(new InstanceIdTarget(this.restateServer.instance.instanceId));

        // Create listeners for each port
        loadBalancer.addListener(`Listener8080-${DEPLOYMENT_ENV_SUFFIX}`, {
            port: 8080,
            protocol: elbv2.Protocol.TCP,
            defaultTargetGroups: [targetGroup8080]
        });

        loadBalancer.addListener(`Listener80-${DEPLOYMENT_ENV_SUFFIX}`, {
            port: 80,
            protocol: elbv2.Protocol.TCP,
            defaultTargetGroups: [targetGroup8080]
        });

        loadBalancer.addListener(`Listener9070-${DEPLOYMENT_ENV_SUFFIX}`, {
            port: 9070,
            protocol: elbv2.Protocol.TCP,
            defaultTargetGroups: [targetGroup9070]
        });

        // Import the ACM certificate for TLS termination
        const certificate = acm.Certificate.fromCertificateArn(this, `RestateCertificate-${DEPLOYMENT_ENV_SUFFIX}`,
            ACM_CERTIFICATE_ARNS[DEPLOYMENT_ENV]
        );
        loadBalancer.addListener(`Listener443-${DEPLOYMENT_ENV_SUFFIX}`, {
            port: 443,
            protocol: elbv2.Protocol.TLS,
            certificates: [certificate],
            defaultTargetGroups: [targetGroup8080]
        });


        // Create a lambda function that will automatically register restate services with the restate server
        this.restateServiceDeployer = new restate.ServiceDeployer(this, `RestateServiceDeployer-${DEPLOYMENT_ENV_SUFFIX}`, {
            functionName: `Web2Text-RestateServiceDeployer-${DEPLOYMENT_ENV_SUFFIX}`,
            securityGroups: [this.restateServer.adminSecurityGroup],
            logGroup: new logs.LogGroup(this, `RestateDeployerLogs-${DEPLOYMENT_ENV_SUFFIX}`, {
                retention: logs.RetentionDays.ONE_WEEK,
                removalPolicy: cdk.RemovalPolicy.RETAIN,
            }),
            vpc,
        });

        // Create a policy that allows the restate server to register lambda services
        const invocationPolicy = new iam.Policy(this, "InvocationPolicy");
        // Wait until the policy is deployed before invoking the restate service deployer
        this.restateServiceDeployer.node.addDependency(invocationPolicy);
        invocationPolicy.attachToRole(this.restateServer.invokerRole);
        invocationPolicy.addStatements(
            new iam.PolicyStatement({
                actions: ["lambda:InvokeFunction"],
                resources: ["*"]
            })
        );
        new cdk.CfnOutput(this, "restateNLBPublicIngressUrl", { value: loadBalancer.loadBalancerDnsName,
            description: "Public ingress URL for the Restate NLB"
         });
        new cdk.CfnOutput(this, "restatePrivateAdminUrl", { value: this.restateServer.adminUrl,
            description: "Private admin URL for the Restate server"
         });
        
    }
}