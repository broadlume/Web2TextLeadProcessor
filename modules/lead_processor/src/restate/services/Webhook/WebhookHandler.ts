import type { ValidationStatus, Validator } from "common";

export type WebhookCall<TPayload> = {
    WebhookId: string;
    Payload: TPayload;
}
export abstract class WebhookHandler<TPayload, TTransformedPayload = TPayload> implements Validator<WebhookCall<TPayload>> { 
    abstract WebhookType: string;
    abstract validate(call: WebhookCall<TPayload>): Promise<ValidationStatus>
    abstract handle(call: WebhookCall<TPayload>): Promise<TTransformedPayload>;
}