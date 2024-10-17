export * as RestateAdminDeploymentAPI from "./RestateAdminDeploymentAPI";
export * as RestateAdminServicesAPI from "./RestateAdminServicesAPI";
export const RESTATE_ADMIN_URL = process.env.RESTATE_ADMIN_URL;
export const RESTATE_INGRESS_URL = RESTATE_ADMIN_URL.replace("admin.","");