import type * as restate from "@restatedev/restate-sdk";
import type { ValidationStatus, Validator } from "common";
import type { NonValidatedLeadState } from "#lead/schema";
import type { ActOnLead } from "./schema";

export class ActOnLeadValidator implements Validator<NonValidatedLeadState<ActOnLead>> {
    constructor(private readonly ctx: restate.ObjectSharedContext) {}

    async validate(lead: NonValidatedLeadState<ActOnLead>): Promise<ValidationStatus> {
        return {
            Name: "ActOn Lead",
            Status: "VALID",
        };
    }
}
