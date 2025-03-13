
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
      
      const { data, error } = await supabase.functions.invoke('xdelo_standardize_storage_paths', {
        body: { 
          limit,
          dryRun: false,
          updatePublicUrls: true
        }
      });

      if (error) throw error;
      
      const result = {
        success: true,
        updatedCount: data.stats?.fixed || 0,
        correlationId: data.correlation_id
      };
      
      setResults(result);
      
      toast({
        title: 'Storage path standardization complete',
        description: `Successfully standardized ${data.stats?.fixed || 0} storage paths and URLs`
      });
      
      return result;
    } catch (error) {
      const errorResult = {
        success: false,
        error: error.message || 'Unknown error occurred'
      };
      
      setResults(errorResult);
      
      toast({
        title: 'Storage path standardization failed',
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
