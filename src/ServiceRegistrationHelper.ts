import { assert, is } from "tsafe";
import { RestateAdminDeploymentAPI } from "./external/restate";
import { logger as _logger } from "./logger";

export async function RegisterThisServiceWithRestate(
	port: number,
): Promise<boolean> {
	const logger = _logger.child({ label: "Startup" });
		try {
			const registered = await RestateAdminDeploymentAPI.CreateDeployment(
				`http://web2text-service:${port}`,
				{
					retry: {
						limit: 2,
					},
				},
			);
			logger.info(
				`Sucessfully registered this restate service deployment'`,
			);
			logger.info(`Deployment ID: '${registered.id}'`);
			return true;
		} catch (e) {
			logger.warn(
				`Failed to register this restate service deployment'`,
			);
			logger.warn(e);
			throw e;
	}
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
			logger.info(
				`Successfully de-registered Web2Text deployment '${deployment.id}' with Restate server`,
			);
		} catch (e) {
			assert(is<Error>(e));
			logger.warn(`Failed to de-register deployment '${deployment.id}'`);
			console.warn(e);
		}
	} else {
		logger.info(`Could not find deployment ID for '${ipAddr}:${port}'`);
	}
}
