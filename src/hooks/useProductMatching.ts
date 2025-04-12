import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  MatchResult,
  BatchMatchResult as LibBatchMatchResult
} from "@/lib/product-matching/types";

export interface ProductMatch extends MatchResult {}

export interface ProductMatchResult {
  success: boolean;
  data?: {
    matches: ProductMatch[];
    bestMatch: ProductMatch | null;
  };
  error?: string;
  duration?: number;
}

export interface BatchMatchResult extends LibBatchMatchResult {}

/**
 * Hook for product matching functionality
 */
export function useProductMatching() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProductMatchResult | null>(null);
  const [batchResult, setBatchResult] = useState<BatchMatchResult | null>(null);

  /**
   * Test product matching with a message or custom text
   */
  const testProductMatch = async (options: {
    messageId?: string;
    customText?: string;
    minConfidence?: number;
  }) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const startTime = performance.now();
      
      const { data, error } = await supabase.functions.invoke('product-matching', {
        body: {
          request: {
            messageId: options.messageId,
            customText: options.customText,
            minConfidence: options.minConfidence || 0.6
          }
        }
      });
      
      const endTime = performance.now();
      
      if (error) {
        throw error;
      }
      
      setResult({
        ...data,
        duration: endTime - startTime
      });
      
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * Batch match multiple messages
   */
  const batchMatchMessages = async (messageIds: string[], minConfidence?: number) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('product-matching', {
        body: {
          messageIds,
          batch: true,
          minConfidence: minConfidence || 0.6
        }
      });
      
      if (error) {
        throw error;
      }
      
      setBatchResult(data);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * Clear all results
   */
  const clearResults = () => {
    setResult(null);
    setBatchResult(null);
    setError(null);
  };
  
  return {
    isLoading,
    error,
    result,
    batchResult,
    testProductMatch,
    batchMatchMessages,
    clearResults
  };
}
