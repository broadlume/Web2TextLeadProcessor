import { z } from "zod";
import { LeadStateSchema } from "#lead";
import { Web2TextLeadSchema } from "#lead/web2text";

export const Web2TextLeadCreateRequestSchema = LeadStateSchema(
	Web2TextLeadSchema,
)
	.options[1].omit({
		Status: true,
		LeadId: true,
		DateSubmitted: true,
		Integrations: true,
		CloseReason: true,
	})
	.extend({
		SyncImmediately: z.boolean().optional(),
	});
export type Web2TextLeadCreateRequest = z.infer<
	typeof Web2TextLeadCreateRequestSchema
>;
