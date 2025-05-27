export type ValidationStatus = {
    Name: string;
	Status: "VALID" | "INVALID" | "NONEXISTANT";
	Reason?: string;
};

export interface Validator<T> {
    validate(object: T): Promise<ValidationStatus>;
}