import type * as restate from "@restatedev/restate-sdk";
import type { Validator } from "common";
import type { IExternalIntegration } from "common/external";
import type { z } from "zod";
import { ActOnIntegration } from "#external/acton/ActOnIntegration";
import { BotpressIntegration } from "#external/botpress/web2text/BotpressIntegration";
import { DHQIntegration } from "#external/dhq/web2text/DHQIntegration";
import { FloorForceIntegration } from "#external/floorforce/FloorForceIntegration";
import { RLMIntegration } from "#external/rlm/web2text/RLMIntegration";
import { TwilioIntegration } from "#external/twilio/web2text/TwilioIntegration";
import type { LeadType, SubmittedLeadState } from "#lead";
import { ActOnLeadSchema, ActOnLeadValidator } from "#lead/acton";
import { Web2TextLeadSchema } from "#lead/web2text";
import { Web2TextLeadValidator } from "#lead/web2text/validation";
import { TWILIO_CLIENT } from "../../../twilio";

type LeadTypeInfoItem = {
    schema: z.AnyZodObject | z.ZodRecord<z.ZodString, z.ZodType<any>>;
    validator: new (ctx: restate.ObjectSharedContext<any>) => Validator<any>;
    integrations: IExternalIntegration<SubmittedLeadState<z.infer<LeadTypeInfoItem["schema"]>>, any>[];
};
export const LeadTypeInfo: Record<LeadType, LeadTypeInfoItem> = {
    WEB2TEXT: {
        schema: Web2TextLeadSchema,
        validator: Web2TextLeadValidator,
        integrations: [
            new TwilioIntegration(TWILIO_CLIENT),
            new BotpressIntegration(),
            new RLMIntegration(TWILIO_CLIENT),
            new DHQIntegration(TWILIO_CLIENT),
        ],
    },
    ACTON: {
        schema: ActOnLeadSchema,
        validator: ActOnLeadValidator,
        integrations: [new ActOnIntegration(), new FloorForceIntegration()],
    },
} as const;
