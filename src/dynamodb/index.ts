import dynamoose from "dynamoose";
import { logger } from "../logger";
import { APIKeyModel } from "./APIKeyModel";
import { LeadStateModel } from "./LeadStateModel";
import { OptedOutNumberModel } from "./OptedOutNumberModel";

if (process.env.LOCAL_DYNAMODB_URL) {
	// Use local DynamoDB instance
	logger
		.child({ label: "DynamoDB" })
		.info(`Using local DynamoDB at '${process.env.LOCAL_DYNAMODB_URL}'`, {
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
	LeadStateModel.table();
	OptedOutNumberModel.table();
}
