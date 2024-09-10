declare global {
    namespace NodeJS {
      interface ProcessEnv {
        TWILIO_ACCOUNT_SID: string;
        TWILIO_AUTH_TOKEN: string;
        TWILIO_API_SID: string;
        TWILIO_API_SECRET: string;
        INTERNAL_TOKEN?: string;
        NEXUS_API_URL: string;
        NEXUS_AWS_API_URL: string;
        NEXUS_API_USERNAME: string;
        NEXUS_API_PASSWORD: string;
        RLM_API_URL: string;
        RESTATE_ADMIN_URL: string;
        LOCAL_DYNAMODB_URL?: string;
        TWILIO_PROXY_URL: string;
        TWILIO_PROXY_USER: string;
        TWILIO_PROXY_PASS: string;
        DHQ_API_URL: string;
        DHQ_API_KEY: string;
        COPILOT_ENVIRONMENT_NAME: "development" | "production" | undefined;
        NODE_ENV: string;
      }
    }
  }
  
  // If this file has no import/export statements (i.e. is a script)
  // convert it into a module by adding an empty export statement.
  export type {};