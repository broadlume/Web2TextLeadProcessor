import type { NonValidatedLeadState, SubmittedLeadState } from "#lead/schema";
import type { Validator, ValidationStatus } from "common";
import type { ActOnLead } from "./schema";
import type * as restate from "@restatedev/restate-sdk";

export class ActOnLeadValidator implements Validator<NonValidatedLeadState<ActOnLead>> {
    constructor(private readonly ctx: restate.ObjectSharedContext) {}

    async validate(lead: NonValidatedLeadState<ActOnLead>): Promise<ValidationStatus> {
        return {
            Name: "ActOn Lead",
            Status: "VALID",
        };
    }
}