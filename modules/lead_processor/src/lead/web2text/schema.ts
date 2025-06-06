import { z } from "zod";
import { NonEmptyString, PhoneNumber, UUID } from "../schema";

export const Web2TextLeadSchema = z.object({
    /**
     * The location this lead is associated with
     */
    LocationId: UUID(),
    /**
     * The page the customer was on when submitting this lead
     */
    PageUrl: NonEmptyString().url(),
    /**
     * The IP address of the customer if it was able to be grabbed
     */
    IPAddress: NonEmptyString().ip().optional(),
    /**
     * The name of the customer
     */
    Name: NonEmptyString(),
    /**
     * The phone number of the customer
     */
    PhoneNumber: PhoneNumber(),
    /**
     * The customer's preferred method of contact
     */
    PreferredMethodOfContact: z.enum(["phone", "text"]).default("text"),
    /**
     * The customer's initial message for the dealer
     */
    CustomerMessage: NonEmptyString(),
    /**
     * If the customer was looking at a product - the details of that product
     */
    AssociatedProductInfo: z
        .object({
            Brand: NonEmptyString(),
            Product: NonEmptyString(),
            Variant: NonEmptyString(),
        })
        .passthrough()
        .optional(),
    /**
     * The Customer's Google Analytic traffic data at time of submission
     */
    Traffic: z
        .object({
            Source: z.string().optional(),
            Medium: z.string().optional(),
            Campaign: z.string().optional(),
            Content: z.string().optional(),
            Term: z.string().optional(),
            Type: z.string().optional(),
        })
        .optional(),
    BotpressConversationId: z.string().optional(),
});
export type Web2TextLead = z.infer<typeof Web2TextLeadSchema>;
