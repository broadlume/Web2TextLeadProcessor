declare global {
    namespace NodeJS {
      interface ProcessEnv {
        TWILIO_ACCOUNT_SID: string;
        TWILIO_AUTH_TOKEN: string;
        TWILIO_API_SID: string;
        TWILIO_API_SECRET: string;
        INTERNAL_TOKEN?: string;
        NEXUS_API_URL: string;
        NEXUS_API_USERNAME: string;
        NEXUS_API_PASSWORD: string;
        RLM_API_URL: string;
      }
    }
  }
  
  // If this file has no import/export statements (i.e. is a script)
  // convert it into a module by adding an empty export statement.
  export type {};