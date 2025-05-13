import { Construct } from "constructs";
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { AwsCustomResource, PhysicalResourceId } from "aws-cdk-lib/custom-resources";
import * as iam from 'aws-cdk-lib/aws-iam';

/**
 * Get the private IPs of the Restate NLB
 * @param scope The scope of the construct
 * @param loadBalancer The NLB
 * @returns The private IPs of the NLB
 */
export function GetPrivateIpsOfLoadBalancer(
    scope: Construct,
    loadBalancer: elbv2.NetworkLoadBalancer,
): string[] {
    const outputPaths = ["NetworkInterfaces.0.PrivateIpAddress", "NetworkInterfaces.1.PrivateIpAddress"];
    const loadBalancerPrivateIp = new AwsCustomResource(scope, `NLB-PrivateIps`, {
        onUpdate: {
            service: "EC2",
            action: "describeNetworkInterfaces",
            outputPaths,
            "parameters": {
                Filters: [
                    {
                        Name: "description",
                        Values: [`ELB ${loadBalancer.loadBalancerFullName}`]
                    }
                ]
            },
            physicalResourceId: PhysicalResourceId.of(Math.random().toString()),
          },
          policy: {
            statements: [
              new iam.PolicyStatement({
                actions: ["ec2:DescribeNetworkInterfaces"],
                resources: ["*"],
              }),
            ],
          },
    });
    return outputPaths.map((path) => loadBalancerPrivateIp.getResponseField(path));
}