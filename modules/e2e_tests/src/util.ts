import type request from "supertest";

export function result(status: number): request.CallbackHandler {
    const s = new Error().stack!.split("\n");
    s.splice(1, 1);

    return (err: any, res: request.Response) => {
        // biome-ignore lint/suspicious/noDoubleEquals: <explanation>
        if ((res?.status || err.status) != status) {
            const e = new Error(
                `Expected ${status} ,got ${res?.status || err.status} resp: ${
                    res?.body ? JSON.stringify(res.body) : err.text
                }`,
            );
            e.stack = e
                .stack!.split("\n")
                .splice(0, 1)
                .concat(s) // Remove this line not to show stack trace
                .join("\n");
            throw e;
        }
    };
}
