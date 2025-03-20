
export interface ProductMatchRequest {
  productName: string;
  vendorName?: string;
  poNumber?: string;
  vendorUid?: string;
  purchaseDate?: string;
  minConfidence?: number;
}

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

export interface ProductMatchResponse {
  success: boolean;
  data?: {
    matches: MatchResult[];
    bestMatch: MatchResult | null;
  };
  error?: string;
}

export interface GlProduct {
  id?: string;
  rowid?: string;
  product_name: string;
  product_code?: string;
  vendor_name?: string;
  vendor_uid?: string;
  po_number?: string;
  created_at?: string;
}
