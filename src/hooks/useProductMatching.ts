
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ProductMatch {
  product_id: string;
  product_name?: string;
  confidence: number;
  match_fields?: string[];
  matchedFields?: string[];
  message_id?: string;
}

export interface ProductMatchResult {
  success: boolean;
  data?: {
    matches: ProductMatch[];
    bestMatch: ProductMatch | null;
  };
  error?: string;
  duration?: number;
}

export interface BatchMatchResult {
  success: boolean;
  results?: any[];
  summary?: {
    total: number;
    matched: number;
    unmatched: number;
    failed: number;
  };
  error?: string;
}

export function useProductMatching() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProductMatchResult | null>(null);
  const [batchResult, setBatchResult] = useState<BatchMatchResult | null>(null);

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
