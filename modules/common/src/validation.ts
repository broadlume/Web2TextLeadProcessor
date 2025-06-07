export type ValidationStatus = {
    Name: string;
    Value?: any;
    Status: "VALID" | "INVALID" | "NONEXISTANT";
    Reason?: string;
};

export interface Validator<T> {
    validate(object: T): Promise<ValidationStatus>;
}

export function ValidationErrorMsg(
    leadingMessage: string,
    status: ValidationStatus,
    includeValue: boolean = false,
): string {
    return `${leadingMessage}: ${status.Name} ${includeValue && status.Value ? `(${JSON.stringify(status.Value)}) ` : ""}is ${status.Status} - ${status.Reason}`;
}
