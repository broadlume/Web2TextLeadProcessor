import type { UUID } from "node:crypto";
import { faker } from "@faker-js/faker";
import type { LeadCreateRequest } from "lead-processor-service/restate/services/Lead/LeadCreateRequest";
import type { E164Number } from "libphonenumber-js/core";
import type { ActOnLead } from "lead-processor-service/lead/acton/schema";
import { NEXUS_FAKE_LOCATION_ID } from "../mock/nexus/handlers";

export function createRandomLeadRequest(override: Partial<LeadCreateRequest> = {}): LeadCreateRequest {
    const lead: LeadCreateRequest = {
        SchemaVersion: "2.0.0",
        UniversalRetailerId: faker.string.uuid() as UUID,
        LeadType: "WEB2TEXT",
        Lead: {
            LocationId: NEXUS_FAKE_LOCATION_ID as UUID,
            PageUrl: faker.internet.url(),
            Name: faker.person.fullName(),
            PhoneNumber: "+12345678900" as E164Number,
            PreferredMethodOfContact: "text",
            CustomerMessage: faker.lorem.paragraph(),
        },
        ...(override as any),
    };
    return lead;
}

export function createRandomActOnLeadRequest(override: Partial<LeadCreateRequest> = {}): LeadCreateRequest {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const email = faker.internet.email();
    const phone = faker.phone.number();
    const zipCode = faker.location.zipCode();
    
    const actOnLead: ActOnLead = {
        "First Name": firstName,
        "Last Name": lastName,
        "E-mail Address": email,
        "Home Phone": phone,
        "Home Postal Code": zipCode,
        preferred_location: faker.location.city(),
        dealername: faker.company.name(),
        dealerurl: faker.internet.url(),
        dealerphone: faker.phone.number(),
        dealerzip: zipCode,
        dealercity: faker.location.city(),
        dealerstate: faker.location.state(),
        formname: "Contact Form",
        source: "Website",
        notes: faker.lorem.paragraph(),
        comments: faker.lorem.sentence(),
    };

    const lead: LeadCreateRequest = {
        SchemaVersion: "2.0.0",
        UniversalRetailerId: faker.string.uuid() as UUID,
        LeadType: "ACTON",
        Lead: actOnLead,
        ...(override as any),
    };
    return lead;
}
