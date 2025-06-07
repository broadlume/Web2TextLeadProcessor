import type { Serde } from "@restatedev/restate-sdk";

export class AnythingSerde implements Serde<Uint8Array> {
    readonly contentType: string = "*/*";
    readonly jsonSchema?: object | undefined = undefined;

    serialize(value: Uint8Array): Uint8Array {
        return value;
    }

    deserialize(value: Uint8Array): Uint8Array {
        return value;
    }
}
