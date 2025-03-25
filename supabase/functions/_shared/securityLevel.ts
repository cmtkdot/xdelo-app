/**
 * Security level enum for backward compatibility
 * Note: JWT verification has been removed and all APIs are set to PUBLIC
 */
export enum SecurityLevel {
  PUBLIC = "public",
  AUTHENTICATED = "authenticated", // Deprecated - treated as PUBLIC
  SERVICE_ROLE = "service_role"    // Deprecated - treated as PUBLIC
} 