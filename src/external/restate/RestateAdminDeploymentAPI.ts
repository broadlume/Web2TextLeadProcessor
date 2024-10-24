import ky, { type RetryOptions } from "ky";
import { ListServices, type RestateService } from "./RestateAdminServicesAPI";
type RestateDeployment = {
	id: string;
	services: RestateService[];
	uri: string;
	protocol_type: "RequestResponse";
	additional_headers: Record<string, string>;
	created_at: string;
	min_protocol_version: number;
	max_protocol_version: number;
};

type CreateDeploymentResponse = {
	id: string;
	services: Required<RestateService>[];
};

type RestateError = {
	message: string;
	/**
	 * Restate error code describing this error
	 */
	restate_code?: string;
};
/**
 * List all registered restate deployments.
 * @returns an array of registered restate deployments
 */
export async function ListDeployments(): Promise<RestateDeployment[]> {
	const restateURL = new URL(process.env.RESTATE_ADMIN_URL!);
	restateURL.pathname += "deployments";

	const json = await ky
		.get(restateURL.toString(), { retry: 0 })
		.json<{ deployments: RestateDeployment[] }>();
	return json.deployments;
}
/**
 * Create deployment.
 * Restate will invoke the endpoint to gather additional information required for registration, such as the services exposed by the deployment.
 * If the deployment is already registered, this method will fail unless force is set to true.
 * @param deploymentUri uri to use to discover/invoke the http deployment.
 * @param options additional options for creating a deployment
 */
export async function CreateDeployment(
	deploymentUri: string,
	options: {
		/**
		 * If true, it will override, if existing, any deployment using the same uri. Beware that this can lead in-flight invocations to an unrecoverable error state.
		 * Default: false
		 */
		force?: boolean;
		/**
		 * If true, discovery will run but the deployment will not be registered. This is useful to see the impact of a new deployment before registering it.
		 * Default: false
		 */
		dryRun?: boolean;
		/**
		 * Additional headers added to the discover/invoke requests to the deployment.
		 */
		additionalHeaders?: Record<string, string>;
		retry?: RetryOptions;
	} = {},
): Promise<CreateDeploymentResponse> {
	try {
		new URL(deploymentUri);
	} catch (e) {
		throw new Error(`deploymentUri '${deploymentUri}' is not a valid URL`);
	}

	const restateURL = new URL(process.env.RESTATE_ADMIN_URL);
	restateURL.pathname += "deployments";

	const json = await ky
		.post(restateURL.toString(), {
			retry: options.retry ?? 0,
			json: {
				uri: deploymentUri,
				additional_headers: options.additionalHeaders ?? {},
				force: options.force ?? false,
				dry_run: options.dryRun ?? false,
			},
		})
		.json<CreateDeploymentResponse>();

	return json;
}

/**
 * Delete a restate deployment
 * @param deploymentId the deployment ID to delete
 * @param options additional options for deleting a deployment
 */
export async function DeleteDeployment(
	deploymentId: string,
	options: {
		/**
		 * If true, the deployment will be forcefully deleted. This might break in-flight invocations, use with caution.
		 * Default: false
		 */
		force?: boolean;
		retry?: RetryOptions;
	} = {},
): Promise<void> {
	options.force ??= false;
	// Currently the restate admin API doesn't support non-forceful deletes.
	// So we work around this by checking if any services are using this deployment, and only allowing the deletion if none are
	if (options.force !== true) {
		const services = await ListServices();
		const serviceUsingDeployment = services.find(
			(s) => s.deployment_id === deploymentId,
		);
		if (serviceUsingDeployment) {
			throw new Error(
				`Cannot delete deployment '${deploymentId}' gracefully - as it is being used by service: '${serviceUsingDeployment.name}'`,
			);
		}
	}
	const restateURL = new URL(process.env.RESTATE_ADMIN_URL);
	restateURL.pathname += `deployments/${deploymentId}`;

	await ky.delete(restateURL.toString(), {
		retry: options.retry ?? 0,
		searchParams: {
			force: true, // options.force
		},
	});
}
