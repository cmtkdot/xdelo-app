
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';

export function useMediaUrlStandardization() {
  const [isStandardizing, setIsStandardizing] = useState(false);
  const [results, setResults] = useState<{
    success: boolean;
    updatedCount?: number;
    error?: string;
    correlationId?: string;
  } | null>(null);
  
  const { toast } = useToast();

  const standardizeUrls = async (limit = 500) => {
    try {
      setIsStandardizing(true);
      
      const { data, error } = await supabase.functions.invoke('xdelo_standardize_urls', {
        body: { limit }
      });

      if (error) throw error;
      
      const result = {
        success: true,
        updatedCount: data.updated_count,
        correlationId: data.correlation_id
      };
      
      setResults(result);
      
      toast({
        title: 'URL standardization complete',
        description: `Successfully standardized ${data.updated_count} media URLs`
      });
      
      return result;
    } catch (error) {
      const errorResult = {
        success: false,
        error: error.message || 'Unknown error occurred'
      };
      
      setResults(errorResult);
      
      toast({
        title: 'URL standardization failed',
        description: error.message,
        variant: 'destructive'
      });
      
      return errorResult;
    } finally {
      setIsStandardizing(false);
    }
  };

  return {
    isStandardizing,
    results,
    standardizeUrls
  };
}
