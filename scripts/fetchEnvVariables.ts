#!/usr/bin/env bun
import { parseArgs } from "node:util";
import { $ } from "bun";

const {values} = parseArgs({
    args: Bun.argv,
    options: {
        secretName: {
            type: "string",
        },
        operation: {
            type: "string",
            default: ""
        }
    },
    allowPositionals: true,
});
const validOperations = ["overwrite", "merge"];
if (!values.secretName) {
    console.error("Error: Secret name is required");
    console.error("Usage: fetchEnvVariables --secretName <secret-name> [--operation <overwrite|merge>]");
    process.exit(1);
}
if (!validOperations.includes(values.operation)) {
    console.error("Error: Invalid or missing operation");
    console.error("Usage: fetchEnvVariables --secretName <secret-name> [--operation <overwrite|merge>]");
    process.exit(1);
}

const awsLoggedIn = await $`aws sts get-caller-identity &>/dev/null`.quiet().then(r => r.exitCode === 0, () => false);
if (!awsLoggedIn) {
    console.error("Error: AWS credentials not found or invalid");
    console.error("Please configure your AWS credentials using 'aws configure' or 'aws sso login'");
    process.exit(1);
}

const envFileExists = await Bun.file(".env").exists();
if (envFileExists) {
    console.log(`.env file already exists (${process.cwd()}/.env)`);
}
else {
    console.log(`.env file does not exist, will create (${process.cwd()}/.env)`);
}
const secret = await $`aws secretsmanager get-secret-value --secret-id ${values.secretName} --query 'SecretString' --output text`.text();

if (!secret) {
    console.error("Error: Failed to fetch secret from AWS Secrets Manager");
    process.exit(1);
}

let secretJson: Record<string, string>;
try {
    secretJson = JSON.parse(secret);
} catch (e) {
    console.error("Error: Failed to parse secret as JSON from AWS Secrets Manager");
    console.error(e);
    process.exit(1);
}

const existingEnv: string = await Bun.file(".env").text().catch(() => "");
const replacedSecrets: string[] = [];
const appendedSecrets: string[] = [];
let newEnv: string[] = [];
for (const line of existingEnv.split("\n")) {
    const uncommentedLine = line.split("#")[0].trim();
    if (uncommentedLine.length == 0) {
        newEnv.push(line);
        continue;
    }
    let [key, value] = uncommentedLine.split("=");
    key = key.trim();
    if (key === "") {
        newEnv.push(line);
        continue;
    }
    if (secretJson[key] === undefined) {
        newEnv.push(line);
        continue;
    }
    if (values.operation == "overwrite") {
        if (value !== secretJson[key]) {
            value = secretJson[key];
            replacedSecrets.push(key);
        }
    }
    else {
        if (value.trim() === "") {
            value = secretJson[key];
            replacedSecrets.push(key);
        }
    }
    delete secretJson[key];
    newEnv.push(`${key}=${value}`);
}
for (const [key, value] of Object.entries(secretJson)) {
    appendedSecrets.push(key);
    newEnv.push(`${key}=${value}`);
}
await Bun.write(".env", newEnv.join("\n"));
console.log(`Successfully ${values.operation == "overwrite" ? "overwrote" : "merged"} ${replacedSecrets.length + appendedSecrets.length} secret values into .env file`);
console.log("Changed secrets:", replacedSecrets.join(", "));
console.log("Appended secrets:", appendedSecrets.join(", "));
process.exit(0);




