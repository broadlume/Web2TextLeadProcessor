import dynamoose from "dynamoose";
if (process.env.LOCAL_DYNAMODB_URL) {
	// Use local DynamoDB instance
	console.log(`[DynamoDB] Using local DynamoDB at '${process.env.LOCAL_DYNAMODB_URL}'`);
	dynamoose.aws.ddb.local(process.env.LOCAL_DYNAMODB_URL);
}
