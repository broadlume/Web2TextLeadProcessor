import { faker } from "@faker-js/faker";
import type { E164Number } from "libphonenumber-js/core";
import type { UUID } from "node:crypto";
import type { Web2TextLeadCreateRequest } from "lead-processor-service/restate/services/Lead/Web2TextLeadCreateRequest";

export function createRandomLeadRequest(override: Partial<Web2TextLeadCreateRequest> = {}): Web2TextLeadCreateRequest {
	const lead: Web2TextLeadCreateRequest = {
		SchemaVersion: "2.0.0",
		UniversalRetailerId: faker.string.uuid() as UUID,
		LeadType: "WEB2TEXT",
		Lead: {
			LocationId: faker.string.uuid() as UUID,
			PageUrl: faker.internet.url(),
			Name: faker.person.fullName(),
			PhoneNumber: faker.phone.number({ style: "international" }) as E164Number,
			PreferredMethodOfContact: "text",
			CustomerMessage: faker.lorem.paragraph(),
		},
        ...override
	};
    return lead;
}