import dynamoose from "dynamoose";
import { APIKeyModel } from "./APIKeyModel";
import { LeadStateModel } from "./LeadStateModel";
if (process.env.LOCAL_DYNAMODB_URL) {
	// Use local DynamoDB instance
	console.log(
		`[DynamoDB] Using local DynamoDB at '${process.env.LOCAL_DYNAMODB_URL}'`,
	);
	dynamoose.aws.ddb.local(process.env.LOCAL_DYNAMODB_URL);
	APIKeyModel.table();
	new APIKeyModel({
		API_Key: process.env["INTERNAL_API_TOKEN"],
		Active: true,
		DateCreated: new Date().toISOString(),
		Description: "Internal development API key",
	}).save();
	LeadStateModel.table();
}
