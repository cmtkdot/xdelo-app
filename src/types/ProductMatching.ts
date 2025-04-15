
import { Json } from '@/integrations/supabase/types';
import { MatchResult } from "./index";

/**
 * Interface for batch processing results
 */
export interface BatchResults {
  success?: boolean;
  total: number;
  matched: number;
  unmatched: number;
  failed: number;
  averageConfidence?: number;
  topMatches?: Array<{
    messageId: string;
    productName: string;
    confidence: number;
  }>;
}

/**
 * Interface for processing message status
 */
export interface ProcessingMessage {
  id: string;
  caption?: string;
  productName?: string;
  vendorUid?: string;
  purchaseDate?: string;
  status: 'processing' | 'matched' | 'unmatched' | 'error';
  processingStartedAt?: string;
  processingCompletedAt?: string;
  matchConfidence?: number;
  matchedProductId?: string;
  matchedProductName?: string;
  errorMessage?: string;
}

