import { http, HttpResponse } from "msw";
import { type FfLeadResponse } from "common/external/floorforce/FfWebAPI";

const FF_API_URL = process.env.FF_API_URL || "https://mock-floorforce-api.example.com";

export const floorforceApiHandlers = [
    http.post(`${FF_API_URL}/external/postactonformdata`, async ({ request }) => {
        const contentType = request.headers.get("content-type");
        
        // Validate content type
        if (!contentType?.includes("application/x-www-form-urlencoded")) {
            const response: FfLeadResponse = {
                status: "failure",
                message: "Invalid content type. Expected application/x-www-form-urlencoded",
            };
            return HttpResponse.json(response, { status: 400 });
        }

        try {
            const body = await request.text();
            const formData = new URLSearchParams(body);

            if (!formData.get("First Name") || !formData.get("Last Name")) {
                const response: FfLeadResponse = {
                    status: "failure",
                    message: "Missing required fields: First Name and Last Name are required",
                };
                return HttpResponse.json(response, { status: 400 });
            }

            // Mock successful response
            const response: FfLeadResponse = {
                status: "success",
                message: "Lead created successfully",
            };

            return HttpResponse.json(response, { status: 200 });
        } catch (error) {
            const response: FfLeadResponse = {
                status: "failure",
                message: "Failed to parse form data",
            };
            return HttpResponse.json(response, { status: 400 });
        }
    })
];