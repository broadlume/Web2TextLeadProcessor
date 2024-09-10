import ky from "ky";

export type RestateService = {
	/**
	 * Fully qualified name of the service
	 */
	name: string;
	/**
	 * Latest revision of the service.
	 */
	revision: number;
	handlers?: {
		name: string;
		ty: string;
		input_description: string;
		output_description: string;
	}[];
	ty?: "Service" | "VirtualObject" | "Workflow";
	/**
	 * Deployment exposing the latest revision of the service.
	 */
	deployment_id?: string;
	/**
	 * If true, the service can be invoked through the ingress. If false, the service can be invoked only from another Restate service.
	 */
	public?: boolean;
	/**
	 * The retention duration of idempotent requests for this service.
	 */
	idempotency_retention?: string;
	/**
	 * The retention duration of workflows. Only available on workflow services.
	 */
	workflow_completion_retention?: string;
};

/**
 * List all registered restate services.
 * @returns an array of registered services
 */
export async function ListServices(): Promise<RestateService[]> {
    const restateURL = new URL(
		process.env.RESTATE_ADMIN_URL,
	);
	restateURL.pathname += "services";

	const json = await ky
		.get(restateURL.toString(), { retry: 0 })
		.json<{ services: RestateService[] }>();
	return json.services;
}
