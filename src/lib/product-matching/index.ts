/**
 * Product Matching Module
 * 
 * This module provides utilities for matching products to messages
 * based on name, vendor, and purchase date information.
 */

// Main matcher functionality
export {
  findMatches,
  matchProduct,
  batchMatchProducts,
  matchProductsToMessage
} from './matcher';

// Configuration utilities
export {
  fetchMatchingConfig,
  updateMatchingConfig,
  ensureMatchingConfig
} from './config';

// Similarity algorithms
export {
  calculateStringSimilarity,
  jaroWinklerSimilarity,
  levenshteinSimilarity
} from './similarity';

// Type definitions
export {
  DEFAULT_CONFIG,
  type ProductMatchingConfig,
  type MatchResult,
  type BatchMatchResult,
  type MatchLogMetadata,
  type MatchableProduct
} from './types'; 