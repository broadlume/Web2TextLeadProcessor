import {z} from "zod";
import parsePhoneNumber, { type E164Number, type PhoneNumber as PhoneNumberType } from 'libphonenumber-js'
import type { UUID as UUIDType } from "node:crypto";

const NonEmptyString = () => z.string().min(1,{message: "String cannot be empty"});
const UUID = () => NonEmptyString().uuid().refine<UUIDType>((x): x is UUIDType => true);
const PhoneNumber = () => NonEmptyString().transform(x => parsePhoneNumber(x,"US")?.number).refine<E164Number>((num): num is E164Number => num != null, {message: "Invalid phone number format"});

export const Web2TextLeadSchema = z.object({
    UniversalClientId: UUID(),
    PageUrl: NonEmptyString().url(),
    IPAddress: NonEmptyString().ip(),
    LeadInformation: z.object({
        Name: NonEmptyString(),
        PhoneNumber: PhoneNumber(),
        LocationName: NonEmptyString().optional(),
        LocationID: UUID(),
        PreferredMethodOfContact: z.enum(["phone","text"]).default("text"),
        CustomerMessage: NonEmptyString(),
        AssociatedProductInfo: z.object({
            Brand: NonEmptyString(),
            Product: NonEmptyString(),
            Variant: NonEmptyString()
        }).optional()
    })
});

export const Web2TextLeadRequestSchema = z.object({
    APIKey: UUID(),
    Lead: Web2TextLeadSchema
});

export type Web2TextLead = z.infer<typeof Web2TextLeadSchema>;
export type Web2TextLeadRequest = z.infer<typeof Web2TextLeadRequestSchema>;

