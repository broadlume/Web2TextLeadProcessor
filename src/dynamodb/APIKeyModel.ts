import dynamoose from "dynamoose";
import { Item } from "dynamoose/dist/Item";

class APIKeyItem extends Item {
    API_Key!: string;
    DateCreated!: string;
    Active!: boolean;
    Description?: string;
}
const APIKeyModelTableName = process.env["COPILOT_ENVIRONMENT_NAME"] === "production" ? "PROD_Web2Text_APIKeys" : "DEV_Web2Text_APIKeys";
export const APIKeyModel = dynamoose.model<APIKeyItem>(APIKeyModelTableName,{
    API_Key: {
        type: String,
        required: true,
        hashKey: true
    },
    DateCreated: {
        type: String,
        required: true
    },
    Active: {
        type: Boolean,
        required: true
    },
    Description: String
});