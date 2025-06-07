#!/bin/bash
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <DEV|PROD|TEST>"
    exit 1
fi

ENV_PREFIX=$1

TABLE_NAMES=("${ENV_PREFIX}_Web2Text_APIKeys" "${ENV_PREFIX}_Web2Text_LeadStates" "${ENV_PREFIX}_Web2Text_OptedOutNumbers" "${ENV_PREFIX}_LeadService_WebhookEventLog")

if [ -n "$LOCAL_DYNAMODB_URL" ]; then
  for TABLE_NAME in "${TABLE_NAMES[@]}"; do
    AWS_ACCESS_KEY_ID=dummy AWS_SECRET_ACCESS_KEY=dummy aws dynamodb delete-table --table-name "$TABLE_NAME" --endpoint-url "$LOCAL_DYNAMODB_URL" --no-paginate > /dev/null
    if [ $? -eq 0 ]; then
      echo "Table $TABLE_NAME deleted successfully."
    else
      echo "Error deleting table $TABLE_NAME."
    fi
  done
else
  echo "LOCAL_DYNAMODB_URL environment variable is not set."
fi