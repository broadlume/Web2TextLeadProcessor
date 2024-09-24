import shelljs from 'shelljs';
import {RestateAdminDeploymentAPI} from "../src/external/restate";
export const LEAD_SERVICE_NAME = "Lead-test";
export const DEALER_SERVICE_NAME = "Dealer-test";
export async function teardown() {
    shelljs.exec("bun run clear-restate-test", { silent: true });
	
	const deployments = await RestateAdminDeploymentAPI.ListDeployments()
	for (const dep of deployments) {
		if (dep.services.find(s => s.name === LEAD_SERVICE_NAME || s.name === DEALER_SERVICE_NAME)) {
			await RestateAdminDeploymentAPI.DeleteDeployment(dep.id,{force: true});
			console.info("[E2E Tests] De-registered test service with Restate server");
		}
	}

}