# Lead Processor Service

The Lead Processor service is a service that create and syncronize leads between our different lead platforms.

## Types Of Leads

Currently the lead processor supports two types of leads

### Web2Text
Web2Text leads send and monitors SMS conversations between dealers and customers, while automatically updating our lead tracking

## Acton
Acton Leads come from ActOn forms submitted from our websites, and are durably sent to our lead tracking (and ActOn).

[Product Specifications](https://broadlume.atlassian.net/wiki/spaces/PM/pages/1502773249/Web2Text+Podium+Replacement) | [Technical Specifications](https://broadlume.atlassian.net/wiki/spaces/ENG/pages/1546911745/Web2Text+Technical+Specification)

## Tools Used
- [Restate](https://restate.dev/)
    - A framework that allows you to run functions as services durably and reliably and orchestrate between them
- [Bun](https://bun.sh/)
    - Used as a package manager
- [Vitest](https://vitest.dev/)
    - A super fast test runner
- [NodeJS](https://nodejs.org/en)
- [Typescript](https://www.typescriptlang.org/)
- [Docker](https://www.docker.com/)
    - Used for providing a unified dev environment using Dev Containers
- [AWS CDK](https://docs.aws.amazon.com/cdk/v2/guide/home.html)
    - Used to deploy all our infrastructure

## Local Setup

1. Pull down the repository
2. Install [Bun](https://bun.sh/)
3. Within the root of the repository, run `bun run fetch-env --operation merge`
    - Make sure you're signed into AWS via `aws sso login`
    - This will fetch environment variables for every module from AWS Secret Manager
    - There are two modes: 
        - `merge` - will append new env variables and only replace empty envs with ones from the secret store
        - `overwrite` - will append new env variables and replace all env variables with ones from the secret store
4. Within VSCode, ensure you have the [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension installed
5. Open the project in VSCode. It should then prompt you to re-open the project in a dev container - click yes.
    - If it doesn't prompt you, press `Cmd+Shift+P` (`Ctrl+Shift+P` on Windows) and type `Build & Open In Container` and run that command
6. Wait for the dev container to spin up
    - This will provision five containers:
        - A dev container where your VSCode window will open in
        - A local restate admin server which will handle taking in requests, durable execution & retries and dispatching them to the service
        - A local DynamoDB database that Web2Text uses for development
        - A twilio proxy application that allows assigning numbers from our pool intelligently to create two way Twilio conversations
        - A local Jaeger instance that collects telemetry from the restate server
    - Verify the restate server is running correctly by running the command `restate whoami` in the dev container
    - Verify the DynamoDB server is running correctly by running the command `dynamodb describe-limits --endpoint-url http://lead-processor-dynamodb-local:8000` in the dev container
7. Open a new terminal within the dev container
8. Navigate to the Lead Processor module
    - `cd modules/lead_processor`
9. Start the Lead Processor service by running `bun run app-dev`
    - This will start the service and will watch for changes to the files
    - **ALTERNATIVELY**: Run the `Debug Lead Processor Service` launch configuration in VSCode to run and attach the NodeJS debugger (allows you to use breakpoints and inspect variables)
10. Open another new terminal and run the command `bun run register-with-restate`
    - This will register the Lead Processor service with the restate server
    - This also clears any existing state, in-flight invocations, and re-registers the service with restate. So you can run it whenever you need to remove/rename/create a handler, reset the KV store of the service or stop any in-flight invocations.
11. Everything should be set up, you should be able to reach the endpoints at `localhost:8080/{service-name}/{object-key}/{endpoint}`
    - The API endpoints require an `Authorization` header of `Bearer <API TOKEN>`
    - You can test locally with whatever API token by setting the `INTERNAL_API_TOKEN` env var to whatever you want
    - I recommend using [Bruno](https://www.usebruno.com/), but Postman will do as well

## Admin UI
Restate has an admin UI that allows you to inspect the state of the services, in-flight invocations, and other metrics.

**You must be on the Broadlume VPN to access the deployed admin UI**

- Local: http://localhost:9070
- Dev: https://admin.web2text.web.dev.broadlume.com:9070
- Prod: https://admin.web2text.web.broadlume.com:9070

## Commands
### Global
> Must be at root of repo

    - `bun run format`
        - Runs biome formatter and linter over the codebase (every module)
    - `bun run check`
        - Runs the typescript compiler over the codebase (every module) and reports any issues
    - `bun run e2e`
        - Runs the e2e_tests module
    - `bun run fetch-env`
        - Fetches environment variables from AWS secret store for development
    - `bun run fetch-env-prod`
        - Fetches environment variables from AWS secret store for production

### Lead Processor
> Must be within `lead_processor` module

    - `bun run format`
        - Runs biome formatter and linter over the codebase
    - `bun run check`
        - Runs the typescript compiler over the codebase and reports any issues
    - `bun run fetch-env`
        - Fetches environment variables from AWS secret store for development
    - `bun run fetch-env-prod`
        - Fetches environment variables from AWS secret store for production
    - `bun run bundle`
        - Packages and bundles the Web2Text service handler into one file in the `dist/` directory
    - `bun run app`
        - Runs the bundled service in production mode
    - `bun run app-dev`
        - Runs the service in development mode with file watching and debugging enabled
    - `bun run reset`
        - Convenience command that clears both restate and dynamodb data
    - `bun run register-with-restate`
        - Clears existing state and registers the service with restate server
    - `bun run clear-restate`
        - Clears all restate data for Lead, Dealer, Admin, and TwilioWebhooks services
    - `bun run clear-dynamodb`
        - Clears all data from local DynamoDB development instance

## Deployment

1. Navigate to the `restate-cdk` module of the repository within the dev container
2. Figure out what stack to deploy
    - lead_processor
        - Deploy this service only if you make any changes in the `web2text` module or any of its dependent modules (e.g. `common`)
    - twilio_proxy
        - Deploy this service only if you make changes to the `twilio_proxy` module
    - restate_server
        - Deploy this only if you need to update the restate server - should be pretty infrequent.
            - **WARNING** Currently deploying the restate server causes downtime since two instances of the restate server cannot be running at the same time, so CDK will deprovision the old server first, then deploy the new one
            - Data/settings will be persisted across upgrades/deployments
            - See the [docs](https://docs.restate.dev/operate/upgrading/) to see if there are any steps needed before safely upgrading 
3. Run `bun run deploy <module> <environment>`
    - If you get an authorization error, run `aws sso login` first
    - There are two environments, `development` and `production`
5. Wait for the command to finish
    - This will also update the restate server with a new deployment automatically

## What is Restate
[Restate](https://restate.dev/) is a framework that allows you to run functions as services durably and reliably and orchestrate between them.

> Durable Execution ensures code runs reliably to the end, even in the presence of failures.
> - Failures and errors are automatically retried (unless labeled as terminal errors)
> - Functions can memoize the results of code blocks, and actions like RPC, in a journal. Completed steps are not re-executed during retries, but replayed from the journal.
> - Workflows are built with regular code and control flow, no custom DSLs needed.
> - Durable sleeps let code wait and suspend for up to months

I **heavily recommend** a read through the [Concepts](https://docs.restate.dev/concepts/durable_building_blocks) page in their documentation to understand how Restate works

## Web2Text Edge Cases
Q. User submits two leads with the same phone number, dealer ID, and location ID

A. Web2Text will prompt the user that a lead is already open on the frontend side and ask if they want to resubmit.
If they do, the old lead will be closed and a new one will be opened

Q. User submits two leads with the same phone number, dealer ID, but different location IDs

A. Web2Text will create two leads and two Twilio conversations

Q. A retailer has two locations, both have the same phone number assigned to them. One user submits a lead to one location, and another submits it to the other location

A. Web2Text will open two leads with the same Twilio conversation ID

Q. A location has open Web2Text leads and changes it's phone number in Nexus/Salesforce

A. Old Web2Text leads will continue to go to the old phone number, while new ones will go to the new phone number

Q. Two locations have the same phone number and two leads are created against both locations with the same phone number

A. Two Web2Text leads will be open for each location using the same Twilio conversation
