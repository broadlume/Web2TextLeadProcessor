import type { LeadState, SubmittedLeadState } from "./schema";
import { Web2TextLeadValidator } from "./web2text/validation";
import { ActOnLeadValidator } from "./acton/validation";
import type * as restate from "@restatedev/restate-sdk";
export type ValidationStatus = {
    Name: string;
	Status: "VALID" | "INVALID" | "NONEXISTANT";
	Reason?: string;
};

export interface Validator<T> {
    validate(object: T): Promise<ValidationStatus>;
}