
/**
 * Statistics about message processing
 */
export interface MessageProcessingStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  error: number;
  initialized: number;
  processingRate: number; // messages per minute
  averageProcessingTime?: number; // in seconds
  oldestPendingMessage?: string; // ISO date string
  recentErrors?: Array<{
    messageId: string;
    error: string;
    timestamp: string;
  }>;
}
