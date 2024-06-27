import * as restate from '@restatedev/restate-sdk';
import { LeadVirtualObject } from './restate/LeadVirtualObject';
// Create the Restate server to accept requests
restate.endpoint().bind(LeadVirtualObject).listen(9075);