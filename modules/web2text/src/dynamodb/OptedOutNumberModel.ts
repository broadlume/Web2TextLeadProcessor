import { ENV_PREFIX } from "common";
import dynamoose from "dynamoose";
import { Item } from "dynamoose/dist/Item";
import type { E164Number } from "libphonenumber-js";
import type { TwilioMessagingServiceBody } from "../restate/services/TwilioWebhooks/TwilioWebhooks";

class OptedOutNumberItem extends Item {
	PhoneNumber!: E164Number;
	OptedOutNumbers!: {
		[number: E164Number]: {
			DateOptedOut: string;
			OptOutRequest: TwilioMessagingServiceBody;
		};
	};
}
const OptedOutNumberTableName = `${ENV_PREFIX}_Web2Text_OptedOutNumbers`;
const OptedOutNumberSchema = new dynamoose.Schema(
	{
		PhoneNumber: {
			type: String,
			required: true,
			hashKey: true,
		},
		OptedOutNumbers: {
			type: Object,
			required: true,
		},
	},
	{ saveUnknown: true },
);
export const OptedOutNumberModel = dynamoose.model<OptedOutNumberItem>(
	OptedOutNumberTableName,
	OptedOutNumberSchema,
);
