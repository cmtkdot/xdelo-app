
/**
 * Result of a matching operation
 */
export interface MatchResult {
  // Core match properties
  isMatch: boolean;
  score: number;
  matches: {
    [key: string]: {
      value: string;
      score: number;
    };
  };
  
  // Additional fields for extended functionality
  id?: string;
  message_id?: string;
  product_id?: string;
  confidence?: number;
  matchType?: string;
  details?: {
    matchedFields: string[];
    confidence: number;
  };
  match_fields?: string[];
  match_date?: string;
}
