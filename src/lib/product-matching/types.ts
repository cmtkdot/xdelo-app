
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
    vendorMinLength: 3,
    dateFormat: "MM/DD/YYYY"
  },
  algorithm: {
    useFuzzySearch: true,
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
    useFuzzySearch?: boolean;
    useJaroWinkler?: boolean;
    useLevenshtein?: boolean;
  };
}

/**
 * Match result interface
 */
export interface MatchResult {
  productId: string;
  confidence: number;
  matchCriteria: {
    nameMatch: boolean;
    vendorMatch: boolean;
    dateMatch: boolean;
  };
  // Additional properties for backward compatibility
  isMatch?: boolean;
  score?: number;
  matches?: Record<string, { value: string; score: number }>;
  message_id?: string;
  product_id?: string;
  match_fields?: string[];
  match_date?: string;
  matchType?: string;
  details?: {
    matchedFields: string[];
    confidence: number;
  };
}

/**
 * Batch match result interface
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
  success?: boolean;
  error?: string;
  summary?: {
    total: number;
    matched: number;
    unmatched: number;
    failed: number;
  };
}

/**
 * Match log metadata interface
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
 * Matchable product interface
 */
export interface MatchableProduct {
  id: string;
  new_product_name?: string;
  name?: string;
  vendor?: string;
  vendor_uid?: string;
  vendor_product_name?: string;
  purchaseDate?: string;
  product_purchase_date?: string;
  display_name?: string;
}
