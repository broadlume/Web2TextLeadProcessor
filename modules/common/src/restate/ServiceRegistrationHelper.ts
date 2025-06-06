import os from "node:os";
import { assert, is } from "tsafe";
import { RestateAdminDeploymentAPI } from "../external/restate";
import { logger as _logger } from "../logger";

export async function RegisterThisServiceWithRestate(port: number): Promise<os.NetworkInterfaceInfo | null> {
    const logger = _logger.child({ label: "Startup" });
    const networkInterfaces = os.networkInterfaces();
    const publicIPv4Networks = Object.keys(networkInterfaces)
        .flatMap((i) => networkInterfaces[i])
        .filter(
            (net) => (net?.family === "IPv4" || (net?.family as unknown as number) === 4) && !net?.internal,
        ) as os.NetworkInterfaceInfo[];
    for (const network of publicIPv4Networks) {
        const restateServiceHost = `${network.address}:${port}`;
        logger.info(`Attempting to register this restate service deployment on '${restateServiceHost}'`);
        try {
            const registered = await RestateAdminDeploymentAPI.CreateDeployment(`http://${restateServiceHost}`, {
                retry: {
                    limit: 2,
                },
            });
            logger.info(`Sucessfully registered this restate service deployment on '${restateServiceHost}'`);
            logger.info(`Deployment ID: '${registered.id}'`);
            return network;
        } catch (e) {
            logger.warn(`Failed to register this restate service deployment on '${restateServiceHost}'`);
            logger.warn(e);
        }
    }
    return null;
}

export async function DeregisterThisServiceWithRestate(
    ipAddr: string,
    port: number,
    options: {
        maxAttempts: number;
        attemptDelayMs: number;
    },
) {
    const logger = _logger.child({ label: "Shutdown" });
    const deployments = await RestateAdminDeploymentAPI.ListDeployments();
    const deployment = deployments.find((d) => new URL(d.uri).host === `${ipAddr}:${port}`);
    if (deployment != null) {
        try {
            await RestateAdminDeploymentAPI.DeleteDeployment(deployment.id, {
                force: false,
                retry: {
                    limit: options.maxAttempts,
                    delay: () => options.attemptDelayMs,
                },
            });
            logger.info(`Successfully de-registered Lead Processor deployment '${deployment.id}' with Restate server`);
        } catch (e) {
            assert(is<Error>(e));
            logger.warn(`Failed to de-register deployment '${deployment.id}'`);
            console.warn(e);
        }
    } else {
        logger.info(`Could not find deployment ID for '${ipAddr}:${port}'`);
    }
}
