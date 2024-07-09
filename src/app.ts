import "dotenv/config";
import * as restate from '@restatedev/restate-sdk';
import { LeadVirtualObject } from './restate/LeadVirtualObject';
import { randomUUID } from "node:crypto";
process.env.INTERNAL_TOKEN ??= randomUUID();
// Create the Restate server to accept requests
restate.endpoint().bind(LeadVirtualObject).listen(9075);