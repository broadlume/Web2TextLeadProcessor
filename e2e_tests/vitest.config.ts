import { defineConfig } from 'vitest/config';
import {config} from "dotenv";
import path from 'node:path';
config({path: path.resolve(__dirname,".env.test")})
export default defineConfig({
    test: {
      include: ["./tests/*"],
      setupFiles: ["dotenv/config","./setup.ts"],
      globalSetup: "./globalSetup.ts",
      pool: "forks",
      poolOptions: {
        forks: {
            singleFork: true,
            isolate: false
        }
      },
      env: process.env,
      deps: {
        optimizer: {
          "ssr": {
            "enabled": false
          },
          web: {
            enabled: false
          }
        }
      },
      isolate: false,
      environment: "node",
      fileParallelism: false
    },
  })