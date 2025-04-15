
import { MatchResult } from "@/types";

/**
 * Default product matching configuration
 */
export const DEFAULT_CONFIG: ProductMatchingConfig = {
  similarityThreshold: 0.7,
  minConfidence: 0.6,
  weights: {
    productName: 0.4,
    vendorUid: 0.3,
    purchaseDate: 0.3
  },
  partialMatch: {
    enabled: true,
    vendorMinLength: 2,
    dateFormat: "YYYY-MM-DD"
  },
  algorithm: {
    useJaroWinkler: true,
    useLevenshtein: false
  }
};

/**
 * Product matching configuration interface
 */
export interface ProductMatchingConfig {
  similarityThreshold: number;
  minConfidence: number;
  weights: {
    productName: number;
    vendorUid: number;
    purchaseDate: number;
  };
  partialMatch: {
    enabled: boolean;
    vendorMinLength?: number;
    dateFormat?: string;
  };
  algorithm: {
    useJaroWinkler: boolean;
    useLevenshtein?: boolean;
  };
}

/**
 * Interface for product to be matched
 */
export interface MatchableProduct {
  id: string;
  new_product_name?: string;
  vendor_product_name?: string;
  vendor_uid?: string;
  product_purchase_date?: string;
}

/**
 * Interface for product matching logs
 */
export interface MatchLogMetadata {
  matchCount: number;
  bestMatchConfidence: number;
  bestMatchProductId: string | null;
  timestamp: string;
  // For backward compatibility
  messageId?: string;
  hasMatch?: boolean;
  confidence?: number;
  matchedProductId?: string;
  matchedFields?: string[];
}

/**
 * Re-export MatchResult from types
 */
export { MatchResult };

/**
 * Interface for batch matching results
 */
export interface BatchMatchResult {
  totalProcessed: number;
  matchedCount: number;
  unmatchedCount: number;
  failedCount: number;
  averageConfidence: number;
  results: Array<{
    messageId: string;
    success: boolean;
    matched: boolean;
    confidence?: number;
    productId?: string;
    error?: string;
  }>;
  // For backward compatibility
  success: boolean;
  summary: {
    total: number;
    matched: number;
    unmatched: number;
    failed: number;
  };
  error?: string;
}
