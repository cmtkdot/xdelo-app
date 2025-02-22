// Supabase Edge Function Types
export interface ProductMatchRequest {
  productName: string;
  vendorName?: string;
  poNumber?: string;
  vendorUid?: string;
  purchaseDate?: string;
  minConfidence?: number;
}

export interface ProductMatchResponse {
  success: boolean;
  data?: {
    matches: ProductMatch[];
    bestMatch: ProductMatch | null;
  };
  error?: string;
}

export interface ProductMatch {
  product_id: string;
  glide_id: string | null;
  confidence_score: number;
  match_priority: number;
  match_details: string;
  match_criteria: {
    name_match: boolean;
    vendor_match: boolean;
    po_match: boolean;
    date_match: boolean;
  };
}

export interface GlProduct {
  id: string;
  glide_id: string | null;
  main_product_name: string | null;
  main_vendor_product_name: string | null;
  main_vendor_uid: string | null;
  main_product_purchase_date: string | null;
  rowid_purchase_order_row_id: string | null;
  created_at?: string;
  updated_at?: string;
}

export const NAME_MATCH_WEIGHTS = {
  MAIN_PRODUCT_NAME: 1.0,
  MAIN_VENDOR_PRODUCT_NAME: 0.9
} as const;

export const PRIORITY_LEVELS = {
  EXACT_PO_HIGH_NAME: { level: 1, minConfidence: 1.0, description: 'Exact PO + High name similarity' },
  EXACT_NAME_VENDOR_DATE: { level: 2, minConfidence: 0.9, description: 'Exact name + vendor + date' },
  EXACT_PO_FUZZY_NAME: { level: 3, minConfidence: 0.7, description: 'Exact PO + fuzzy name' },
  FUZZY_NAME_VENDOR_DATE: { level: 4, minConfidence: 0.6, description: 'Fuzzy name + vendor + date' }
} as const;
