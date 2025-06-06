import { ENV_PREFIX } from "common";
import dynamoose from "dynamoose";
import { Item } from "dynamoose/dist/Item";

class APIKeyItem extends Item {
    API_Key!: string;
    DateCreated!: string;
    Active!: boolean;
    AuthorizedEndpoints!: string[];
    Description?: string;
}
// TODO: Rename this table name to something more generic once we figure out what to call this monorepo
const APIKeyModelTableName = `${ENV_PREFIX}_Web2Text_APIKeys`;
export const APIKeyModel = dynamoose.model<APIKeyItem>(APIKeyModelTableName, {
    API_Key: {
        type: String,
        required: true,
        hashKey: true,
    },
    DateCreated: {
        type: String,
        required: true,
    },
    AuthorizedEndpoints: {
        type: Array,
        schema: [String],
        required: true,
    },
    Active: {
        type: Boolean,
        required: true,
    },
    Description: String,
});
