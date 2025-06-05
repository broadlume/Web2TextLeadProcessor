import { HttpResponse, http } from "msw";

export const dhqApiHandlers = [
    http.post(`${process.env.DHQ_API_URL}/*`, () => {
        return HttpResponse.json({ status: "success", data: { lead: { id: "dhq-lead-id" } } });
    }),
];
