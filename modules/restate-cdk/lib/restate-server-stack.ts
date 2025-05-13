import { DEPLOYMENT_ENV_SUFFIX } from '../bin/restate-cdk';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as restate from '@restatedev/restate-cdk';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { InstanceIdTarget } from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { GetPrivateIpsOfLoadBalancer } from './util/GetLoadBalancerPrivateIps';
interface RestateServerStackProps extends cdk.StackProps {
    vpcId: string;
    nlbSubnetIds: string[];
    acmCertificateArn: string;
    envVariables: Record<string, string>;
}

export class RestateServerStack extends cdk.Stack {
    public readonly restateServer: restate.SingleNodeRestateDeployment;
    public readonly restateServiceDeployer: restate.ServiceDeployer;
    public readonly vpc: ec2.IVpc;
    constructor(scope: Construct, id: string, props: RestateServerStackProps) {
        super(scope, id, props);
        this.vpc = ec2.Vpc.fromLookup(this, "Vpc", { vpcId: props.vpcId });
        const vpc = this.vpc;

        // Create the restate server on an EC2 instance
        this.restateServer = new restate.SingleNodeRestateDeployment(this, `RestateServer-${DEPLOYMENT_ENV_SUFFIX}`, {
            publicIngress: true,
            networkConfiguration: {
                subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
            },
            environment: {
                ...props.envVariables,
                RESTATE_TRACING_ENDPOINT: "http://localhost:4317",
                RESTATE_LOG_FORMAT: "json",
            },
            vpc,
            restateTag: "1.3.2",
            tracing: restate.TracingMode.AWS_XRAY,
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.LARGE),
            dataVolumeOptions: {
                "volumeSize": 128,
            },
            logGroup: new logs.LogGroup(this, `RestateLogs-${DEPLOYMENT_ENV_SUFFIX}`, {
                logGroupName: `/lead-service-${DEPLOYMENT_ENV_SUFFIX.toLowerCase()}/restate-server-logs`,
                retention: logs.RetentionDays.ONE_MONTH,
                removalPolicy: cdk.RemovalPolicy.DESTROY,
            }),
        });
        // Set the EC2 instance name
        cdk.Tags.of(this.restateServer.instance).add('Name', `LeadService-RestateServer-${DEPLOYMENT_ENV_SUFFIX}`);
        const loadBalancerSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(this, "RestateServerSecurityGroup", "sg-0125cec8ff948873f");
        
        const loadBalancer = new elbv2.NetworkLoadBalancer(this, `RestateNLB-${DEPLOYMENT_ENV_SUFFIX}`, {
            loadBalancerName: `LeadService-RestateNLB-${DEPLOYMENT_ENV_SUFFIX}`,
            vpc,
            vpcSubnets: {
                subnets: props.nlbSubnetIds.map((id: string, idx: number) => ec2.Subnet.fromSubnetId(this, `RestateLoadBalancerSubnet-${idx}`, id))
            },
            securityGroups: [this.restateServer.adminSecurityGroup, loadBalancerSecurityGroup],
            internetFacing: true,
        });
        cdk.Tags.of(loadBalancer).add('Name', `LeadService-RestateNLB-${DEPLOYMENT_ENV_SUFFIX}`);

        const loadBalancerName = cdk.Names.uniqueResourceName(loadBalancer, {});
        // Create target groups for each port
        const targetGroup8080 = new elbv2.NetworkTargetGroup(this, `${loadBalancerName}-RestateTargetGroup8080-${DEPLOYMENT_ENV_SUFFIX}`, {
            vpc,
            port: 8080,
            protocol: elbv2.Protocol.TCP,
            targetType: elbv2.TargetType.INSTANCE,
            healthCheck: {
                enabled: true,
                port: '8080'
            }
        });
        const targetGroup9070 = new elbv2.NetworkTargetGroup(this, `${loadBalancerName}-RestateTargetGroup9070-${DEPLOYMENT_ENV_SUFFIX}`, {
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
            defaultTargetGroups: [targetGroup9070],
        });

        // Import the ACM certificate for TLS termination
        const certificate = acm.Certificate.fromCertificateArn(this, `RestateCertificate-${DEPLOYMENT_ENV_SUFFIX}`,
            props.acmCertificateArn
        );
        loadBalancer.addListener(`Listener443-${DEPLOYMENT_ENV_SUFFIX}`, {
            port: 443,
            protocol: elbv2.Protocol.TLS,
            certificates: [certificate],
            defaultTargetGroups: [targetGroup8080]
        });

        // Create a lambda function that will automatically register restate services with the restate server
        this.restateServiceDeployer = new restate.ServiceDeployer(this, `RestateServiceDeployer-${DEPLOYMENT_ENV_SUFFIX}`, {
            functionName: `LeadService-RestateServiceDeployer-${DEPLOYMENT_ENV_SUFFIX}`,
            securityGroups: [this.restateServer.adminSecurityGroup],
            logGroup: new logs.LogGroup(this, `RestateDeployerLogs-${DEPLOYMENT_ENV_SUFFIX}`, {
                logGroupName: `/lead-service-${DEPLOYMENT_ENV_SUFFIX.toLowerCase()}/restate-service-deployer-logs`,
                retention: logs.RetentionDays.ONE_WEEK,
                removalPolicy: cdk.RemovalPolicy.RETAIN,
            }),
            vpc,
        });
        
        // Create a policy that allows the restate server to access lambda services
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
        // Output the private IPs of the Restate NLB
        // While HTTP ingress on port 80, 8080, and 443 is allowed via the public IP of the NLB,
        // port 9070 (the admin panel) is only accesible from internal IPs
        // Since our VPN is in split tunnel mode, in order to access the admin panel we need the admin DNS entry to be set to the private IPs of the NLB
        const privateIps = GetPrivateIpsOfLoadBalancer(this, loadBalancer);
        new cdk.CfnOutput(this, "restateNLBPrivateIps", { 
            value: privateIps.join(","),
            description: "The private IPs of the Restate NLB (multiple IPs for different AZs)"
        });
        new cdk.CfnOutput(this, "restateNLBPublicIngressUrl", { 
            value: loadBalancer.loadBalancerDnsName,
            description: "Public ingress URL for the Restate NLB"
         });
        
    }
}