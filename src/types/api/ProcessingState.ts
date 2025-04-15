
/**
 * Enum for message processing states
 */
export type ProcessingState = 
  | 'initialized' 
  | 'pending' 
  | 'processing' 
  | 'completed' 
  | 'error'
  | 'no_caption'
  | 'pending_analysis';
