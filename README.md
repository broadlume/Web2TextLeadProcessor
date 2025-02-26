# Web2Text Lead Processor

Web2Text is a service that will send and monitor SMS conversations between dealers and customers, while automatically updating our lead tracking.

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
- [AWS Copilot](https://aws.github.io/copilot-cli/)
    - Used to deploy all our services to AWS ECS smoothly

## Local Setup

1. Pull down the repository
2. **Get the .env file from a senior developer and place it in the root of the repository**
3. **Within the `twilio_proxy` module - update its ENV file to include TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN**
4. Within VSCode, ensure you have the [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension installed
5. Open the project in VSCode. It should then prompt you to re-open the project in a dev container - click yes.
    - If it doesn't prompt you, press `Cmd+Shift+P` (`Ctrl+Shift+P` on Windows) and type `Build & Open In Container` and run that command
6. Wait for the dev container to spin up
    - This will provision seven containers:
        - The Web2Text dev container where your VSCode window will open in
        - The restate admin server which will handle taking in requests, durable execution & retries and dispatching them to the service
        - A local DynamoDB database that Web2Text uses for development
        - A twilio proxy application that allows assigning numbers from our pool intelligently to create two way Twilio conversations
        - A local Jaeger instance that collects telemetry from the restate server
        - A swagger UI instance that displays the documentation
    - Verify the restate-server is running correctly by running the command `restate whoami` in the dev container
    - Verify the DynamoDB server is running correctly by running the command `dynamodb describe-limits --endpoint-url http://web2text-dynamodb-local:8000` in the dev container
7. Open a new terminal within the dev container
8. Navigate to the web2text module
    - `cd modules/web2text`
9. Start the Web2Text service by running `bun run app-dev`
    - This will start the Web2Text service and will watch for changes to the files
    - **ALTERNATIVELY**: Run the `Debug Web2Text Service` launch configuration in VSCode to run and attach the NodeJS debugger (allows you to use breakpoints and inspect variables)
10. Open another new terminal and run the command `bun run register-with-restate`
    - This will register the Web2Text service with the restate server
    - This also clears any existing state, in-flight invocations, and re-registers the service with restate. So you can run it whenever you need to remove/rename/create a handler, reset the KV store of the service or stop any in-flight invocations.
11. Everything should be set up, you should be able to reach the endpoints at `localhost:8080/{service-name}/{object-key}/{endpoint}`
    - The API endpoints require an `Authorization` header of `Bearer <API TOKEN>`
    - I recommend using [Bruno](https://www.usebruno.com/), but Postman will do as well

## Admin UI
Restate has an admin UI that allows you to inspect the state of the services, in-flight invocations, and other metrics.

- Local: http://localhost:9070
- Dev: https://admin.web2text.web.dev.broadlume.com:9070
- Prod: https://admin.web2text.web.broadlume.com:9070

## API Docs
There is a Swagger instance hosted at
- Local: http://localhost:8001
- Dev: http://docs.web2text.web.dev.broadlume.com
- Prod: http://docs.web2text.web.broadlume.com


## Commands
### Global
> Must be at root of repo

    - `bun run format`
        - Runs biome formatter and linter over the codebase (every module)
    - `bun run check`
        - Runs the typescript compiler over the codebase (every module) and reports any issues
    - `bun run e2e`
        - Runs the e2e_tests module

### Web2Text
> Must be within `web2text` module

    - `bun run format`
        - Runs biome formatter and linter over the codebase
    - `bun run check`
        - Runs the typescript compiler over the codebase and reports any issues
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

1. Navigate to the root of the repository (outside of the dev container)
2. Run `copilot deploy`
    - If you get an authorization error, run `aws sso login` first
    - There are two environments, `development` and `production`
3. Select the service to deploy
    - web2text-service
        - Deploy this service only if you make any changes in the `web2text` module or any of its dependent modules (e.g. `common`)
    - twilio-proxy
        - Deploy this service only if you make changes to the `twilio_proxy` module
   - swagger-docs
        - Deploy this service only if you make changes to the `swagger_docs` module
    - restate-server
        - Deploy this only if you need to update the restate server - should be pretty infrequent.
            - **WARNING** Currently deploying the restate server causes downtime since two instances of the restate server cannot be running at the same time, so ECS will deprovision the server first, then deploy the new one
            - See the [docs](https://docs.restate.dev/operate/upgrading/) to see if there are any steps needed before safely upgrading 
4. Select the environment to deploy to
5. Wait for the command to finish
    - This will also update the restate server with a new deployment automatically and (if possible and there are no inflight invocations) de-register the old deployment

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
> Each location has its own Twilio phone number

Q. A retailer has two locations, both have the same phone number assigned to them. One user submits a lead to one location, and another submits it to the other location

A. Web2Text will open two leads with the same Twilio conversation ID

Q. A location has open Web2Text leads and changes it's phone number in Nexus/Salesforce

A. Old Web2Text leads will continue to go to the old phone number, while new ones will go to the new phone number

Q. Two locations have the same phone number and two leads are created against both locations with the same phone number

A. Two Web2Text leads will be open for each location using the same Twilio conversation
