
export interface MatchResult {
  product_name: string;
  product_id?: string;
  confidence_score: number;
  match_details?: string;
  vendor_uid?: string;
  product_code?: string;
}
