
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';

export function useStoragePathStandardization() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<{
    success: boolean;
    processed?: number;
    fixed?: number;
    skipped?: number;
    needsRedownload?: number;
    error?: string;
    correlationId?: string;
  } | null>(null);
  
  const { toast } = useToast();

  const standardizeStoragePaths = async (limit = 200, dryRun = false, messageIds: string[] = []) => {
    try {
      setIsProcessing(true);
      
      const { data, error } = await supabase.functions.invoke('xdelo_standardize_storage_paths', {
        body: { 
          limit,
          dryRun,
          messageIds: messageIds.length > 0 ? messageIds : undefined
        }
      });

      if (error) throw error;
      
      const result = {
        success: true,
        processed: data.stats.processed,
        fixed: data.stats.fixed,
        skipped: data.stats.skipped,
        needsRedownload: data.stats.needs_redownload,
        correlationId: data.correlation_id
      };
      
      setResults(result);
      
      toast({
        title: 'Storage path standardization complete',
        description: `Processed ${data.stats.processed} files, fixed ${data.stats.fixed}, skipped ${data.stats.skipped}`
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
      setIsProcessing(false);
    }
  };

  return {
    isProcessing,
    results,
    standardizeStoragePaths
  };
}
