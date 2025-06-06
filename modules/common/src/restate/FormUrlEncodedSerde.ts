import type * as restate from "@restatedev/restate-sdk";
export class FormUrlEncodedSerde implements restate.Serde<object> {
    readonly contentType: string = "application/x-www-form-urlencoded";

    serialize(value: object): Uint8Array {
        const params = new URLSearchParams();
        for (const [key, val] of Object.entries(value)) {
            params.append(key, val.toString());
        }
        const serialized = params.toString();
        return new TextEncoder().encode(serialized);
    }

    deserialize(data: Uint8Array): object {
        const decoded = new TextDecoder().decode(data);
        const params = new URLSearchParams(decoded);
        const result: { [key: string]: string } = {};
        params.forEach((value, key) => {
            result[key] = value;
        });
        return result;
    }
}
