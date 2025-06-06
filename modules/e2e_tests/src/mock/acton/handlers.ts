import type { ActOnListAPI } from "common/external/acton";
import { HttpResponse, http } from "msw";

const ACTON_BASE_URL = process.env.ACTON_BASE_URL || "https://mock-acton-api.example.com";

export const actonApiHandlers = [
    // Mock ActOn Create Contact API
    http.post(`${ACTON_BASE_URL}/api/1/list/:listId/record`, async ({ request, params }) => {
        const { listId } = params;
        const body = await request.json();

        // Validate required fields
        if (!body || typeof body !== "object") {
            return HttpResponse.json(
                {
                    status: "error",
                    message: "Invalid request body",
                    id: "",
                    contact_id: "",
                },
                { status: 400 },
            );
        }

        // Mock successful response
        const response: ActOnListAPI.ActOnResponse = {
            status: "success",
            message: "Contact created successfully",
            id: `mock_record_${Date.now()}`,
            contact_id: `mock_contact_${Date.now()}`,
        };

        return HttpResponse.json(response, { status: 200 });
    }),

    // Mock ActOn token endpoint
    http.post(`${ACTON_BASE_URL}/token`, async ({ request }) => {
        return HttpResponse.json(
            {
                access_token: "mock_access_token",
                refresh_token: "mock_refresh_token",
                scope: "read write",
                token_type: "Bearer",
                expires_in: 3600,
            },
            { status: 200 },
        );
    }),
];
