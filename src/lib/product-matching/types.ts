
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
}

/**
 * Match log metadata interface
 */
export interface MatchLogMetadata {
  matchCount: number;
  bestMatchConfidence: number;
  bestMatchProductId: string | null;
  timestamp: string;
}

/**
 * Matchable product interface
 */
export interface MatchableProduct {
  id: string;
  name: string;
  vendor: string;
  purchaseDate: string;
}
