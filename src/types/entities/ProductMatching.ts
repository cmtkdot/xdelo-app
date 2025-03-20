
/**
 * Interface for product matching log metadata
 */
export interface MatchLogMetadata {
  matchCount: number;
  hasBestMatch: boolean;
  bestMatchConfidence: number;
  bestMatchProductId: string | null;
  timestamp: string;
}

/**
 * Interface for product matching configuration
 */
export interface ProductMatchingConfig {
  similarityThreshold: number;
  partialMatch: {
    enabled: boolean;
    minLength?: number;
    dateFormat?: string;
  };
  weightedScoring: {
    name: number;
    vendor: number;
    purchaseDate: number;
  };
}

/**
 * Interface for product matching test results
 */
export interface MatchTestResult {
  messageId: string;
  hasMatch: boolean;
  matchCount: number;
  bestMatch?: {
    productId: string;
    confidence: number;
    criteria: string[];
  };
  processingTime?: number;
}

/**
 * Interface for product matching batch results
 */
export interface MatchBatchResult {
  messagesProcessed: number;
  messagesMatched: number;
  averageConfidence: number;
  failedMessages: string[];
  completedAt: string;
}

/**
 * Interface for product match recommendations
 */
export interface MatchRecommendation {
  id: string;
  messageId: string;
  productId: string;
  confidence: number;
  matchFields: string[];
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

/**
 * Interface for gl_products fields we need for matching
 */
export interface MatchableProduct {
  id: string;
  productName: string;
  vendorCode: string;
  purchaseDate: string;
  displayName: string;
}

/**
 * Interface for custom mapping fields
 */
export interface CustomMapping {
  id: string;
  messageField: string;
  productField: string;
  weight: number;
  matchType: 'exact' | 'partial' | 'fuzzy';
  isEnabled: boolean;
}
