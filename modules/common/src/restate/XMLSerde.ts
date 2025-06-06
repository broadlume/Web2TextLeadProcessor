import type * as restate from "@restatedev/restate-sdk";
export class XMLSerde implements restate.Serde<string> {
    readonly contentType: string = "text/xml";

    serialize(value: string): Uint8Array {
        const encoder = new TextEncoder();
        return encoder.encode(value);
    }

    deserialize(data: Uint8Array): string {
        const decoder = new TextDecoder();
        return decoder.decode(data);
    }
}
