
/**
 * Result of matching a message to a product
 */
export interface MatchResult {
  message_id: string;
  product_id: string;
  confidence: number;
  match_fields: string[];
  match_date: string;
  id?: string;
  matchType?: string;
  details?: Record<string, any>;
}
