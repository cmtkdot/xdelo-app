
import type { ProcessingState } from '../api/ProcessingState';

/**
 * Statistics about message processing
 */
export interface MessageProcessingStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  error: number;
  by_processing_state: Record<ProcessingState, number>;
  by_media_type: {
    photo: number;
    video: number;
    document: number;
    other: number;
  };
  processing_times: {
    avg_seconds: number;
    max_seconds: number;
  };
  latest_update: string;
}
