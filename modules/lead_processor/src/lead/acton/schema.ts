import z from "zod";

export const ActOnLeadSchema = z.record(z.string(), z.any());
export type ActOnLead = z.infer<typeof ActOnLeadSchema>;
