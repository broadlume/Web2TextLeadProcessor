import shelljs from 'shelljs';
export async function teardown() {
    shelljs.exec("bun run clear-restate-test", { silent: true });
	// De-register the deployment
	const table = shelljs.exec("restate services list", { silent: true }).stdout;
	const deploymentId = /dp_[a-zA-z\d]+/.exec(table)?.[0];
	if (deploymentId != null) {
		shelljs.exec(`restate deployments remove ${deploymentId} --force --yes`, {
			silent: true,
		});
		console.info("[E2E Tests] De-registered test service with Restate server");
	}
}