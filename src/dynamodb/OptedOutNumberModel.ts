import dynamoose from "dynamoose";
import { Item } from "dynamoose/dist/Item";
import type { E164Number } from "libphonenumber-js";
import { ENV_PREFIX } from "./Environment";
import type { TwilioMessagingServiceBody } from "../restate/TwilioWebhooks";

class OptedOutNumberItem extends Item {
	PhoneNumber!: E164Number;
	DateOptedOut!: string;
	OptOutRequest?: TwilioMessagingServiceBody;
}
const OptedOutNumberTableName = `${ENV_PREFIX}_Web2Text_OptedOutNumbers`;
export const OptedOutNumberModel = dynamoose.model<OptedOutNumberItem>(
	OptedOutNumberTableName,
	{
		PhoneNumber: {
			type: String,
			required: true,
			hashKey: true,
		},
		DateOptedOut: {
			type: String,
			required: true,
		},
		OptOutRequest: {
			type: Object,
			required: false
		}
	},
);
