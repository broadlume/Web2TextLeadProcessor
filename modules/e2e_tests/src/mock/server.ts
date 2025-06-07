import { http, passthrough } from "msw";
import { setupServer } from "msw/node";
import { actonApiHandlers } from "./acton/handlers";
import { dhqApiHandlers } from "./dhq/handlers";
import { floorforceApiHandlers } from "./floorforce/handlers";
import { nexusApiHandlers, nexusAwsApiHandlers } from "./nexus/handlers";
import { rlmApiHandlers } from "./rlm/handlers";
import { twilioApiHandlers } from "./twilio/handlers";

const whiteListedRoutes = [http.all("http://localhost*", passthrough), http.all("http://127.0.0.1*", passthrough)];
export const handlers = [
    ...actonApiHandlers,
    ...floorforceApiHandlers,
    ...nexusApiHandlers,
    ...nexusAwsApiHandlers,
    ...rlmApiHandlers,
    ...twilioApiHandlers,
    ...dhqApiHandlers,
    ...whiteListedRoutes,
];
export const mockServer = setupServer(...handlers);
