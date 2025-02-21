import type { UUID as UUIDType } from "node:crypto";
import { ExternalIntegrationStateSchema } from "common/external";
import z, { Schema } from "zod";

const NonEmptyString = () =>
	z.string().min(1, { message: "String cannot be empty" });
const UUID = () =>
	NonEmptyString()
		.uuid()
		.refine<UUIDType>((x): x is UUIDType => true);
export const WebFormLeadSchema = z.object({
	ao_a: z.string(),
	ao_f: z.string(),
	ao_d: z.string(),
	ao_p: z.string(),
	ao_jstzo: z.string(),
	ao_cuid: z.string().optional(),
	ao_srcid: z.string().optional(),
	ao_bot: z.string(),
	ao_camp: z.string().optional(),
	"First Name": z.string(),
	"Last Name": z.string(),
	"E-mail Address": z.string().email(),
	"Home Phone": z.string(),
	"Home Postal Code": z.string(),
	preferred_location: z.string(),
	dealername: z.string(),
	dealermhwkacct: z.string().optional(),
	dealerurl: z.string().optional(),
	dealerfrom: z.string().optional(),
	dealerlogo: z.string().url(),
	dealeraddr: z.string(),
	dealeraddrline: z.string().optional(),
	dealerphone: z.string(),
	dealerfacebook: z.string().optional(),
	dealertwitter: z.string().optional(),
	dealeryoutube: z.string().optional(),
	dealergooglep: z.string().optional(),
	dealerlinkedin: z.string().optional(),
	dealerinstagram: z.string().optional(),
	dealerpinterest: z.string().optional(),
	omnifycampaign: z.string(),
	tags: z.string().optional(),
	formname: z.string(),
	promotion: z.string(),
	source: z.string(),
	foreignid: z.string(),
	dealerzip: z.string(),
	storelocation: z.string().optional(),
	formcategory: z.string(),
	sourcedetail: z.string(),
	sourceurl: z.string().url(),
	dealercity: z.string(),
	dealerstate: z.string(),
	"traffic-type": z.string().optional(),
	"traffic-medium": z.string().optional(),
	"traffic-source": z.string().optional(),
	"traffic-term": z.string().optional(),
	"traffic-content": z.string().optional(),
	"traffic-campaign": z.string().optional(),
	"floorlytics-blob": z.string().optional(),
	notes: z.string(),
	comments: z.string(),
	optin: z.string(),
	ao_form_neg_cap: z.string().optional(),
});
const ActOnLeadSchema = z.object({
	SchemaVersion: z.enum(["1.0.0"]).default("1.0.0"),
	LeadID: UUID(),
	Lead: WebFormLeadSchema,
	Status: z.enum(["ACTIVE", "SYNCING", "CLOSED"]),
	UniversalRetailerId: UUID(),
	Integrations: z.record(z.string(), ExternalIntegrationStateSchema),
});

const LeadStateSchema = z.discriminatedUnion("Status", [
	z.object({
		Status: z.literal("NONEXISTANT"),
	}),
	z.object({
		Status: z.literal("VALIDATING"),
		Request: z.unknown(),
	}),
	ActOnLeadSchema,
	z.object({
		Status: z.literal("ERROR"),
		Error: z.any(),
		Request: z.unknown(),
	}),
]);

export type LeadState = z.infer<typeof LeadStateSchema>;

export type WebLead = z.infer<typeof ActOnLeadSchema>;

export type WebFormLead = z.infer<typeof WebFormLeadSchema>;
