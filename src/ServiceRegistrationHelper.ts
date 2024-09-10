import os from "node:os";
import { RestateAdminDeploymentAPI } from "./external/restate";
import { assert, is } from "tsafe";

export async function RegisterThisServiceWithRestate(
	port: number,
): Promise<os.NetworkInterfaceInfo | null> {
	const networkInterfaces = os.networkInterfaces();
	const publicIPv4Networks = Object.keys(networkInterfaces)
		.flatMap((i) => networkInterfaces[i])
		.filter(
			(net) =>
				(net?.family === "IPv4" || (net?.family as unknown as number) === 4) &&
				!net?.internal,
		) as os.NetworkInterfaceInfo[];
	for (const network of publicIPv4Networks) {
		const restateServiceHost = `${network.address}:${port}`;
		console.info(
			`[STARTUP] Attempting to register this restate service deployment on '${restateServiceHost}'`,
		);
		try {
			const registered = await RestateAdminDeploymentAPI.CreateDeployment(
				`http://${restateServiceHost}`,
				{
					retry: {
						limit: 2,
					}
				}
			);
			console.info(
				`[STARTUP] Sucessfully registered this restate service deployment on '${restateServiceHost}'`,
			);
			console.info(`[STARTUP] Deployment ID: '${registered.id}'`);
			return network;
		} catch (e) {
			console.warn(
				`[STARTUP] Failed to register this restate service deployment on '${restateServiceHost}'`,
			);
			console.warn(e);
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
	const deployments = await RestateAdminDeploymentAPI.ListDeployments();
	const deployment = deployments.find(
		(d) => new URL(d.uri).host === `${ipAddr}:${port}`,
	);
	if (deployment != null) {
		try {
			await RestateAdminDeploymentAPI.DeleteDeployment(deployment.id, {
				force: false,
				retry: {
					limit: options.maxAttempts,
					delay: () => options.attemptDelayMs,
				},
			});
			console.info(
				`[SHUTDOWN] Successfully de-registered Web2Text deployment '${deployment.id}' with Restate server`,
			);
		} catch (e) {
			assert(is<Error>(e));
			console.warn(
				`[SHUTDOWN] Failed to de-register deployment '${deployment.id}'`,
			);
			console.warn(e);
		}
	} else {
		console.info(
			`[SHUTDOWN] Could not find deployment ID for '${ipAddr}:${port}'`,
		);
	}
}
