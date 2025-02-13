import type { E164Number } from "libphonenumber-js";
import memoizee from "memoizee";
import type { Twilio } from "twilio";
import { PhoneNumberInstance } from "twilio/lib/rest/lookups/v2/phoneNumber";

async function _lookupPhoneNumber(
	twilioClient: Twilio,
	phoneNumber: E164Number,
): Promise<PhoneNumberInstance> {
	const lookup = await twilioClient.lookups.v2
		.phoneNumbers(phoneNumber)
		.fetch({ fields: "line_type_intelligence" });
	return lookup;
}

export const LookupPhoneNumber = memoizee(_lookupPhoneNumber, {
	promise: true,
	normalizer(args) {
		return args[1]; // don't use twilio client as part of cache key
	},
	maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
	max: 8192, // max cache entries, LRU clearing
});
