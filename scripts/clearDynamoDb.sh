#!/bin/bash

TABLE_NAMES=("Web2Text_APIKeys" "Web2Text_LeadStates")  # Replace with your DynamoDB table names

if [ -n "$LOCAL_DYNAMODB_URL" ]; then
  for TABLE_NAME in "${TABLE_NAMES[@]}"; do
    aws dynamodb delete-table --table-name "$TABLE_NAME" --endpoint-url "$LOCAL_DYNAMODB_URL"
    if [ $? -eq 0 ]; then
      echo "Table $TABLE_NAME deleted successfully."
    else
      echo "Error deleting table $TABLE_NAME."
    fi
  done
else
  echo "LOCAL_DYNAMODB_URL environment variable is not set."
fi