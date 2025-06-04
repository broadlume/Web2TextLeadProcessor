import { HttpResponse, http } from "msw";
import { v4 as uuidv4 } from "uuid";

export const rlmApiHandlers = [
    http.post(`${process.env.RLM_API_URL}/*`, () => {
        return HttpResponse.json({
            result: "Success",
            lead_id: 12345,
            lead_uuid: uuidv4(),
        });
    }),
];
