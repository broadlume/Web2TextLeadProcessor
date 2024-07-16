import dynamoose from "dynamoose";
if (process.env.LOCAL_DYNAMODB_URL) {
	// Use local DynamoDB instance
	dynamoose.aws.ddb.local(process.env.LOCAL_DYNAMODB_URL);
}
