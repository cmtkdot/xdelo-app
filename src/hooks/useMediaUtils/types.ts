
/**
 * Result type for repair operations
 */
export interface RepairResult {
  success: boolean;
  message?: string;
  error?: string;
  data?: any;
  successful?: number;
  failed?: number;
}
