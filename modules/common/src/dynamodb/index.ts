import { logger } from "common";
import dynamoose from "dynamoose";
import type { ModelType } from "dynamoose/dist/General";
import { APIKeyModel } from "./APIKeyModel";
export { APIKeyModel };
/**
 * Initialize the local DynamoDB instance and create the necessary tables
 * @param models - The models to initialize tables for
 * @returns True if the local DynamoDB instance was initialized, false otherwise
 */
export function InitLocalDynamoDb(models: ModelType<any>[]): boolean {
    process.env.AWS_ACCESS_KEY_ID = "DUMMY";
    process.env.AWS_SECRET_ACCESS_KEY = "DUMMY";
    // If the local DynamoDB instance is not set, return false
    if (process.env.LOCAL_DYNAMODB_URL == null) {
        console.log("this is false");
        return false;
    }
    logger.child({ label: "DynamoDB" }).info(`Using local DynamoDB at '${process.env.LOCAL_DYNAMODB_URL}'`, {
        DynamoDBURL: process.env.LOCAL_DYNAMODB_URL,
    });
    dynamoose.aws.ddb.local(process.env.LOCAL_DYNAMODB_URL);
    APIKeyModel.table();
    new APIKeyModel({
        API_Key: process.env["INTERNAL_API_TOKEN"],
        Active: true,
        DateCreated: new Date().toISOString(),
        AuthorizedEndpoints: ["*"],
        Description: "Internal development API key",
    }).save();
    for (const model of models) {
        // Initialize the table on the local database
        model.table();
    }
    return true;
}
