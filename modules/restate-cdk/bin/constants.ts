export const VPC_IDS = {
    "development": "vpc-086692d4081db1b6f",
    "production": "vpc-03741c60c9bab6d40"
}

export const NLB_SUBNET_IDS = {
    "development": [
        "subnet-0748be9bc387e9bed",
        "subnet-0a97c28c458f887ee"
    ],
    "production": [
        "subnet-0e9c927aad4a5501d",
        "subnet-047f7f0f73dd803c1"
    ]
}

export const NLB_SECURITY_GROUP_IDS = {
    "development": "sg-0125cec8ff948873f",
    "production": "sg-041e2e25be813531e"
}

export const ACM_CERTIFICATE_ARNS = {
    "development": "arn:aws:acm:us-east-1:202061849983:certificate/f18856c4-831f-41e0-927f-11f5410bfcdc",
    "staging": "arn:aws:acm:us-east-1:202061849983:certificate/47bd373d-637e-42ed-9677-ec0f8dbbd8fb",
    "production": "arn:aws:acm:us-east-1:202061849983:certificate/e96ebcf1-a25a-4427-8ac2-4e25df123872"
}