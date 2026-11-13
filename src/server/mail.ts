import "server-only";
export { publicUrl as appUrl } from "./email/config";
/** UI capability indicator, not a delivery guarantee. */
export function isMailConfigured(): boolean { return process.env.EMAIL_PROVIDER === "smtp"; }
