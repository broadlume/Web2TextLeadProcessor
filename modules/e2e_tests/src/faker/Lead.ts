import type { UUID } from "node:crypto";
import { faker } from "@faker-js/faker";
import type { LeadCreateRequest } from "lead-processor-service/restate/services/Lead/LeadCreateRequest";
import type { E164Number } from "libphonenumber-js/core";

export function createRandomLeadRequest(override: Partial<LeadCreateRequest> = {}): LeadCreateRequest {
    const lead: LeadCreateRequest = {
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
        ...(override as any),
    };
    return lead;
}
