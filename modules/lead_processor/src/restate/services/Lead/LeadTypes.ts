import { ActOnLeadValidator } from "#lead/acton";
import { ActOnLeadSchema } from "#lead/acton";
import { Web2TextLeadValidator } from "#lead/web2text/validation";
import { Web2TextLeadSchema } from "#lead/web2text";
import { TwilioIntegration } from "#external/twilio/web2text/TwilioIntegration";
import { BotpressIntegration } from "#external/botpress/web2text/BotpressIntegration";
import { RLMIntegration } from "#external/rlm/web2text/RLMIntegration";
import { DHQIntegration } from "#external/dhq/web2text/DHQIntegration";
import { TWILIO_CLIENT } from "../../../twilio";
import type { LeadType, SubmittedLeadState, Validator } from "#lead";
import type { IExternalIntegration } from "common/external";
import type { z } from "zod";
import type * as restate from "@restatedev/restate-sdk";
import { ActOnIntegration } from "#external/acton/ActOnIntegration";
import { FloorForceIntegration } from "#external/floorforce/FloorForceIntegration";
type LeadTypeInfoItem = {
    schema: z.AnyZodObject | z.ZodRecord<z.ZodString, z.ZodType<any>>,
    validator: new (ctx: restate.ObjectSharedContext<any>) => Validator<any>,
    integrations: IExternalIntegration<SubmittedLeadState<z.infer<LeadTypeInfoItem["schema"]>>, any>[]
}
export const LeadTypeInfo: Record<LeadType, LeadTypeInfoItem> = {
    "WEB2TEXT": {
        schema: Web2TextLeadSchema,
        validator: Web2TextLeadValidator,
        integrations: [
            new TwilioIntegration(TWILIO_CLIENT),
            new BotpressIntegration(),
            new RLMIntegration(TWILIO_CLIENT),
            new DHQIntegration(TWILIO_CLIENT)
        ]
    },
    "ACTON": {
        schema: ActOnLeadSchema,
        validator: ActOnLeadValidator,
        integrations: [
            new ActOnIntegration(),
            new FloorForceIntegration()
        ]
    },
} as const;
