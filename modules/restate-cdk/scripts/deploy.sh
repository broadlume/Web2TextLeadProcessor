#!/bin/bash

declare -A STACKS=( ["lead_processor"]="LeadServiceStack" ["restate_server"]="RestateServerStack" ["twilio_proxy"]="TwilioProxyStack" ["all"]="all")
declare ENVIRONMENTS=("development" "production")
declare -A ENV_PREFIX=("development" "DEV" "production" "PROD")

if [ -z "$1" ]; then
    echo "Usage: $0 <module_name> <environment>"
    echo "Valid modules are: ${!STACKS[@]}"
    exit 1
fi
if [ -z "${STACKS[$1]}" ]; then
    echo "Invalid module name: $1"
    echo "Usage: $0 <module_name> <environment>"
    echo "Valid modules are: ${!STACKS[@]}"
    exit 1
fi

if [ -z "$2" ]; then
    echo "Usage: $0 <module_name> <environment>"
    echo "Valid environments are: ${ENVIRONMENTS[@]}"
    exit 1
fi

if [[ ! " ${ENVIRONMENTS[@]} " =~ " ${2} " ]]; then
    echo "Invalid environment: $2"
    echo "Usage: $0 <module_name> <environment>"
    echo "Valid environments are: ${ENVIRONMENTS[@]}"
    exit 1
fi

# Check if user is logged into AWS
if ! aws sts get-caller-identity &> /dev/null; then
    echo "You are not logged into AWS. Please run 'aws sso login' first."
    exit 1
fi

if [ "$1" == "all" ]; then
    DEPLOY_ENV=$2 bun cdk deploy --all
    exit 0
fi



DEPLOY_ENV=$2 bun cdk deploy ${STACKS[$1]}-${ENV_PREFIX[$2]}