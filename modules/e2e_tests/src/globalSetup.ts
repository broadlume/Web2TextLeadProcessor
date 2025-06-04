import { RestateTestEnvironment } from '@restatedev/restate-sdk-testcontainers';
import {GenericContainer, type StartedTestContainer} from 'testcontainers'
import type { TestProject } from 'vitest/node'
export const LEAD_SERVICE_NAME = "Lead-test";
export const DEALER_SERVICE_NAME = "Dealer-test";
export const ADMIN_SERVICE_NAME = "Admin-test";
export let restateServerContainer: RestateTestEnvironment;
export let apiMockContainer: StartedTestContainer;
export async function setup(project: TestProject) {
    restateServerContainer = await RestateTestEnvironment.start(() => {});
    const leadProcessorContainerImage = await GenericContainer.fromDockerfile(
        "/app",
        "./modules/lead_processor/Dockerfile.test"
    ).withBuildkit().build();
    // project.onTestsRerun(async () => {
    //     await leadProcessorContainer.stop();
    //     await leadProcessorContainer.start();
    // });
}
export async function teardown() {
    if (restateServerContainer) {
        await restateServerContainer.stop();
    }
    if (leadProcessorContainer) {
        await leadProcessorContainer.stop();
    }
    if (apiMockContainer) {
        await apiMockContainer.stop();
    }
}
