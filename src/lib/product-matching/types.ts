/**
 * Core product matching types for the new implementation
 */

/**
 * Interface for product matching configuration
 */
export interface ProductMatchingConfig {
  // Core thresholds
  similarityThreshold: number;
  minConfidence: number;
  
  // Scoring weights
  weights: {
    productName: number;
    vendorUid: number;
    purchaseDate: number;
  };
  
  // Partial matching settings
  partialMatch: {
    enabled: boolean;
    vendorMinLength: number;
    dateFormat: string;
  };
  
  // Algorithm settings
  algorithm: {
    useFuzzySearch: boolean;
    useJaroWinkler: boolean;
    useLevenshtein: boolean;
  };
}

/**
 * Default configuration values
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
    dateFormat: 'YYYY-MM-DD'
  },
  
  algorithm: {
    useFuzzySearch: true,
    useJaroWinkler: true,
    useLevenshtein: false
  }
};

/**
 * Interface for match result data
 */
export interface MatchResult {
  // Core properties
  isMatch: boolean;
  score: number;
  confidence: number;
  
  // Match details
  product_id: string;
  message_id: string;
  matchType: 'automatic' | 'manual' | 'partial';
  match_fields: string[];
  matchedFields?: string[]; // For backward compatibility
  
  // Additional metadata
  match_date?: string;
  details?: Record<string, any>;
  
  // Match specifics
  matches: {
    product_name: {
      value: string;
      score: number;
    };
    vendor_uid?: {
      value: string;
      score: number;
    };
    purchase_date?: {
      value: string;
      score: number;
    };
  };
}

/**
 * Interface for batch processing results
 */
export interface BatchMatchResult {
  success: boolean;
  results?: Array<{
    messageId: string;
    success: boolean;
    bestMatch: MatchResult | null;
    error?: string;
  }>;
  summary?: {
    total: number;
    matched: number;
    unmatched: number;
    failed: number;
  };
  error?: string;
}

/**
 * Interface for product matching log metadata
 */
export interface MatchLogMetadata {
  messageId: string;
  hasMatch: boolean;
  confidence?: number;
  matchedProductId?: string;
  matchedProductName?: string;
  matchedFields?: string[];
  duration?: number;
  error?: string;
}

/**
 * Interface for product fields needed for matching
 */
export interface MatchableProduct {
  id: string;
  new_product_name: string | null;
  vendor_product_name?: string | null;
  vendor_uid?: string | null;
  product_purchase_date?: string | null;
  [key: string]: any;
} 