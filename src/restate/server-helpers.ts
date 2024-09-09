import shelljs from "shelljs";
import os from 'node:os';
type RestateDeployment = {
	DEPLOYMENT: string;
	TYPE: string;
	STATUS: string;
	"ACTIVE INVOCATIONS": number;
	ID: string;
	"CREATED AT": Date;
};
export async function GetDeployment(
	deploymentHost: string,
): Promise<RestateDeployment | null> {
	const deployments = await GetDeployments();
	return (
		deployments.find((dp) => new URL(dp.DEPLOYMENT).host === deploymentHost) ??
		null
	);
}
export async function GetDeployments(): Promise<RestateDeployment[]> {
	const registeredDeploymentsOut = (await new Promise((resolve, reject) =>
		shelljs.exec(
			"RESTATE_HOST=web2text-restate-server restate dep list",
			{ async: true, silent: true },
			(code, stdout, stderr) =>
				code === 0 ? resolve(stdout as string) : reject(stderr as string),
		),
	).catch((stderr: string) => {
		if (stderr.includes("No deployments were found!")) {
			return "";
		}
		throw new Error("Failed to list restate deployments", { cause: stderr });
	})) as string;
	if (registeredDeploymentsOut === "") return [];
	const separated = registeredDeploymentsOut
		.split(/\n/)
		.map((line) => line.split(/\s{2,}/).filter((t) => t !== ""))
		.slice(1)!;
	const parsed = separated.filter(entry => entry.length === 6).map((entry) => ({
		DEPLOYMENT: entry[0].trim(),
		TYPE: entry[1].trim(),
		STATUS: entry[2].trim(),
		"ACTIVE INVOCATIONS": Number.parseInt(entry[3].trim()),
		ID: entry[4].trim(),
		"CREATED AT": new Date(entry[5].trim()),
	}));
	return parsed;
}

export async function RegisterThisServiceWithRestate(port: number): Promise<os.NetworkInterfaceInfo | null> {
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
		const registered = await new Promise((resolve, reject) =>
			shelljs.exec(
				`RESTATE_HOST=web2text-restate-server restate dep reg ${restateServiceHost} --yes`,
				{ async: true, silent: true },
				(code, stdout, stderr) =>
					code === 0 ? resolve(stdout) : reject(stderr),
			),
		).then(
			(stdout) => {
				console.info(
					`[STARTUP] Sucessfully registered this restate service deployment on '${restateServiceHost}`,
				);
				return true;
			},
			(stderr) => {
				console.warn(
					`[STARTUP] Failed to register this restate service deployment on '${restateServiceHost}'`,
				);
				console.warn(stderr);
				return false;
			},
		);
		if (registered) {
			return network;
		}
	}
	return null;
}

function sleep(ms: number) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

export async function DeregisterThisServiceWithRestate(
	ipAddr: string,
	port: number,
	options: {
		maxAttempts: number;
		attemptDelayMs: number;
	},
) {
	const deployment = await GetDeployment(`${ipAddr}:${port}`);
	if (deployment != null) {
		while (options.maxAttempts--) {
			const result = (await new Promise((resolve, reject) =>
				shelljs.exec(
					`restate deployments remove ${deployment.ID} --yes`,
					{
						async: true,
						silent: true,
					},
					(code, stdout, stderr) => resolve({ code, stdout, stderr }),
				),
			)) as { code: number; stdout: string; stderr: string };
			if (result.code === 0) {
                console.info("[SHUTDOWN] De-registered Web2Text deployment with Restate server");
				return;
			}
			console.warn(
				`[SHUTDOWN] Failed to deregister deployment '${deployment.ID}' -- retrying...`,
			);
			console.warn(result.stderr);
            await sleep(options.attemptDelayMs);
		}
	} else {
		console.warn(
			`[SHUTDOWN] Could not find deployment ID for '${ipAddr}:${port}' - failed to de-register service!`,
		);
	}
}
