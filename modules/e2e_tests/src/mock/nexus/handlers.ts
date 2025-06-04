import { HttpResponse, http } from "msw";

export const NEXUS_FAKE_LOCATION_ID = "f780e263-833b-4979-9cdb-0e2c22f5c5a2";
export const nexusApiHandlers = [
    http.get(`${process.env.NEXUS_API_URL}/retailers/:retailerId`, ({ params }) => {
        const retailerId = params.retailerId;
        return HttpResponse.json({
            id: retailerId,
            name: "Test Client",
            status: "Customer",
            rlm_api_key: "test_api_key",
        });
    }),
    http.get(`${process.env.NEXUS_API_URL}/retailers/:retailerId/subscriptions`, ({ params }) => {
        return HttpResponse.json([
            {
                status: "Live",
                web2text_opt_out: false,
                subscription_status: "Live",
            },
        ]);
    }),
    http.get(`${process.env.NEXUS_API_URL}/retailers/:retailerId/stores`, (request) => {
        return HttpResponse.json([
            {
                id: NEXUS_FAKE_LOCATION_ID,
                store_name: "Test Store",
                street_address: "123 Test St",
                Web2Text_Phone_Number: "+12345678900",
            },
        ]);
    }),
];

export const nexusAwsApiHandlers = [
    http.get(`${process.env.NEXUS_AWS_API_URL}/nexus/location`, ({ request }) => {
        const url = new URL(request.url);
        const locationId = url.searchParams.get("location_id");
        if (!locationId || Object.keys(Object.fromEntries(url.searchParams)).length !== 1) {
            return new HttpResponse(null, { status: 400 });
        }
        if (locationId !== NEXUS_FAKE_LOCATION_ID) {
            return new HttpResponse(null, { status: 400 });
        }
        return HttpResponse.json({
            data: [
                {
                    id: locationId,
                    location_id: locationId,
                    Web2Text_Phone_Number: "+12246591932",
                },
            ],
        });
    }),
    http.get(`${process.env.NEXUS_AWS_API_URL}/nexus/retailerLocations`, ({ request }) => {
        const url = new URL(request.url);
        const retailerId = url.searchParams.get("retailer_id");
        if (!retailerId) {
            return new HttpResponse(null, { status: 400 });
        }
        return HttpResponse.json({
            data: [
                {
                    birdeye_account_id: "12345",
                    birdeye_business_account_id: "67890",
                    call_tracking_number: "+1234567890",
                    city: "Test City",
                    country: "USA",
                    hours_of_operation: "9:00 AM - 5:00 PM",
                    id: NEXUS_FAKE_LOCATION_ID,
                    latitude: "40.7128",
                    location_id: NEXUS_FAKE_LOCATION_ID,
                    location_name: "Test Store",
                    longitude: "-74.0060",
                    mohawk_store_id: "M12345",
                    retailer_account_name: "Test Retailer",
                    retailer_id: retailerId,
                    state_province: "CA",
                    store_name: "Test Store",
                    store_phone_number: "+1234567890",
                    Web2Text_Phone_Number: "+1234567890",
                    store_type: "Retail",
                    street_address: "123 Test St",
                    universal_id: NEXUS_FAKE_LOCATION_ID,
                    zip_code: "12345",
                },
            ],
        });
    }),
];
