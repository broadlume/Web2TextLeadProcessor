import shelljs from "shelljs";
import { RestateAdminDeploymentAPI } from "common/external/restate";
export const LEAD_SERVICE_NAME = "Lead-test";
export const DEALER_SERVICE_NAME = "Dealer-test";
export const ADMIN_SERVICE_NAME = "Admin-test";
export const TWILIO_WEBHOOKS_SERVICE_NAME = "TwilioWebhooks-test"
console.log("globalsetup");
console.log(RestateAdminDeploymentAPI);
export async function teardown() {
	console.log("running teardown");
	shelljs.exec("bun run clear-restate-test", { silent: true });
	const deployments = await RestateAdminDeploymentAPI.ListDeployments();
	for (const dep of deployments) {
		if (
			dep.services.find(
				(s) => s.name === LEAD_SERVICE_NAME || s.name === DEALER_SERVICE_NAME,
			)
		) {
			await RestateAdminDeploymentAPI.DeleteDeployment(dep.id, { force: true });
			console.info(
				"[E2E Tests] De-registered test service with Restate server",
			);
		}
	}
}
