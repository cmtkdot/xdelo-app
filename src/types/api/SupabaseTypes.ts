
/**
 * Standardized API response types for Supabase operations
 */

export interface ApiResponse<T = any> {
  data: T | null;
  error: Error | null;
  status: number;
  statusText?: string;
  metadata?: Record<string, any>;
}

export interface StorageOperationResult {
  success: boolean;
  path?: string;
  url?: string;
  error?: string;
  metadata?: Record<string, any>;
}
