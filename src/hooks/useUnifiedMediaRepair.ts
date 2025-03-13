
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';
import { logEvent, LogEventType } from '@/lib/logUtils';

interface RepairOptions {
  messageIds?: string[];
  limit?: number;
  checkStorageOnly?: boolean;
}

interface RepairResult {
  success: boolean;
  results?: {
    processed: number;
    repaired: number;
    verified: number;
    failed: number;
    details: any[];
  };
  error?: string;
}

export function useUnifiedMediaRepair() {
  const [isRepairing, setIsRepairing] = useState(false);
  const [results, setResults] = useState<RepairResult | null>(null);
  const { toast } = useToast();

  const repairMedia = async (options: RepairOptions = {}): Promise<RepairResult> => {
    try {
      setIsRepairing(true);

      // Log the start of the repair operation
      await logEvent(
        LogEventType.SYSTEM_REPAIR,
        'unified-media-repair',
        {
          operation: 'unified_media_repair',
          options,
          status: 'started'
        }
      );

      // Call the edge function
      const { data, error } = await supabase.functions.invoke('xdelo_unified_media_repair', {
        body: {
          messageIds: options.messageIds,
          limit: options.limit || 50,
          checkStorageOnly: options.checkStorageOnly || false
        }
      });

      if (error) {
        throw new Error(`Edge function error: ${error.message}`);
      }

      // Process results
      const result: RepairResult = {
        success: data.success,
        results: data.results,
        error: data.error
      };

      setResults(result);

      // Log the completion of the repair
      await logEvent(
        LogEventType.SYSTEM_REPAIR,
        'unified-media-repair',
        {
          operation: 'unified_media_repair',
          options,
          status: 'completed',
          results: data.results
        }
      );

      // Show a toast with the results
      if (data.success && data.results) {
        toast({
          title: 'Media Repair Complete',
          description: `Processed ${data.results.processed} files: ${data.results.repaired} repaired, ${data.results.verified} verified, ${data.results.failed} failed.`
        });
      } else if (data.message) {
        toast({
          title: 'Media Check Complete',
          description: data.message
        });
      }

      return result;
    } catch (error) {
      console.error('Media repair error:', error);

      // Log the error
      await logEvent(
        LogEventType.SYSTEM_REPAIR,
        'unified-media-repair',
        {
          operation: 'unified_media_repair',
          options,
          status: 'failed'
        },
        undefined,
        undefined,
        error.message
      );

      // Show error toast
      toast({
        title: 'Media Repair Failed',
        description: error.message,
        variant: 'destructive'
      });

      const errorResult: RepairResult = {
        success: false,
        error: error.message
      };

      setResults(errorResult);
      return errorResult;
    } finally {
      setIsRepairing(false);
    }
  };

  return {
    isRepairing,
    results,
    repairMedia
  };
}
