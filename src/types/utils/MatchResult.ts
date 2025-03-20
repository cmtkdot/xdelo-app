
export interface MatchResult {
  product_name: string;
  product_id?: string;
  confidence_score: number;
  match_details?: string;
  vendor_uid?: string;
  product_code?: string;
  glide_id?: string;
  match_priority?: 'high' | 'medium' | 'low';
}
