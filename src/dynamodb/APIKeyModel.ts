import dynamoose from "dynamoose";
import { Item } from "dynamoose/dist/Item";

class APIKeyItem extends Item {
    API_Key!: string;
    DateCreated!: Date;
    Active!: boolean;
    Description?: string;
}

export const APIKeyModel = dynamoose.model<APIKeyItem>("Web2Text_APIKeys",{
    API_Key: {
        type: String,
        required: true,
        hashKey: true
    },
    DateCreated: {
        type: {
            value: Date,
            settings: {
                storage: "iso"
            }
        },
        required: true
    },
    Active: {
        type: Boolean,
        required: true
    },
    Description: String
});