import {supertest} from "../../setup";
import { describe, it } from "vitest";
import { DEALER_SERVICE_NAME } from "../../globalSetup";
import { v4 as uuidv4 } from "uuid";
describe("Dealer Status Authentication", () => {
    const mockUniversalRetailerId = uuidv4();
    it("should return 401 for invalid API key", async () => {
		await supertest
			.get(`/${DEALER_SERVICE_NAME}/${mockUniversalRetailerId}/status`)
			.auth("invalid-api-key", { type: "bearer" })
			.expect(401);
	});
})