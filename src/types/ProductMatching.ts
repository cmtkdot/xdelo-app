
import { MatchResult } from "./index";

/**
 * Interface for batch processing results
 */
export interface BatchResults {
  success: boolean;
  results: Array<{
    success: boolean;
    bestMatch: MatchResult | null;
    matches?: MatchResult[];
  }>;
  summary: {
    total: number;
    matched: number;
    unmatched: number;
    failed: number;
  };
  error?: string;
}

/**
 * Interface for processing message status
 */
export interface ProcessingMessage {
  id: string;
  caption: string;
  analyzed_content: any;
  vendor_uid: string;
  product_name: string;
  purchase_date: string;
}

/**
 * Interface for GL Products
 */
export interface GlProduct {
  id: string;
  glide_id: string;
  new_product_name: string;
  vendor_product_name: string;
  vendor_uid: string;
  product_purchase_date: string;
  created_at: string;
  updated_at: string;
  product_name_display: string;
}
