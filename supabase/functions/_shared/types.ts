/**
 * Standard API response type for all edge functions
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  correlationId: string;
  timestamp: string;
}

/**
 * Standard error response type
 */
export interface ErrorResponse {
  success: false;
  error: string;
  errorCode: string;
  correlationId: string;
  timestamp: string;
  stack?: string;
}

/**
 * Standard success response type
 */
export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  correlationId: string;
  timestamp: string;
}

/**
 * Request metadata for logging and tracing
 */
export interface RequestMetadata {
  correlationId: string;
  method: string;
  path: string;
  processingTime: number;
  status: number;
  userAgent?: string;
  ipAddress?: string;
}

/**
 * Standardized function options
 */
export interface FunctionOptions {
  securityLevel?: SecurityLevel; // Added
  allowedMethods?: HttpMethod[]; // Added
  enableCors: boolean;
  enableMetrics: boolean;
  enableLogging: boolean;
  requireAuth: boolean;
  validateRequest?: boolean;
}

// Added missing type definitions
export enum SecurityLevel {
  PUBLIC = "public",
  AUTHENTICATED = "authenticated",
  SERVICE_ROLE = "service_role"
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS';
