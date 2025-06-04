import { http, passthrough } from "msw";
import { setupServer } from "msw/node";
import { dhqApiHandlers } from "./dhq/handlers";
import { nexusApiHandlers, nexusAwsApiHandlers } from "./nexus/handlers";
import { rlmApiHandlers } from "./rlm/handlers";
import { twilioApiHandlers } from "./twilio/handlers";

const whiteListedRoutes = [
    http.all(`${process.env.LOCAL_DYNAMODB_URL!}*`, passthrough),
    http.all("http://localhost*", passthrough),
    http.all("http://127.0.0.1*", passthrough),
];
export const handlers = [
    ...nexusApiHandlers,
    ...nexusAwsApiHandlers,
    ...rlmApiHandlers,
    ...twilioApiHandlers,
    ...dhqApiHandlers,
    ...whiteListedRoutes,
];
export const mockServer = setupServer(...handlers);
