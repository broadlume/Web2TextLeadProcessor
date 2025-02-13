import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import { resolve } from "path";
export default defineConfig({
	resolve: {
		alias: [
			{ find: "common", replacement: resolve(__dirname, "../common/src") },
			{ find: "web2text", replacement: resolve(__dirname, "../web2text/src") }
		]
	},

	test: {
		include: ["./src/tests/**/*"],
		setupFiles: ["dotenv/config", "./src/setup.ts"],
		globalSetup: "./src/globalSetup.ts",
		pool: "forks",
		poolOptions: {
			forks: {
				singleFork: true,
				isolate: false,
			},
		},
		env: process.env,
		deps: {
			optimizer: {
				ssr: {
					enabled: false,
				},
				web: {
					enabled: false,
				},
			},
		},
		sequence: {
			hooks: "list",
		},
		isolate: false,
		environment: "node",
		fileParallelism: false,
		coverage: {
			"enabled": false
		}
	},
	plugins: [tsconfigPaths({
		loose: true,
		root: "/app"
	})],
});
