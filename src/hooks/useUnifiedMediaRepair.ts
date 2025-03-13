
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';
import { logEvent, LogEventType } from '@/lib/logUtils';

interface RepairOptions {
  messageIds?: string[];
  mediaGroupId?: string;
  limit?: number;
  checkStorageOnly?: boolean;
  fixContentTypes?: boolean;
  storagePathOnly?: boolean;
  forceRedownload?: boolean;
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
  message?: string;
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
        LogEventType.MEDIA_REPAIR_STARTED,
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
          mediaGroupId: options.mediaGroupId,
          limit: options.limit || 50,
          checkStorageOnly: options.checkStorageOnly || false,
          fixContentTypes: options.fixContentTypes || true,
          storagePathOnly: options.storagePathOnly || false,
          forceRedownload: options.forceRedownload || false
        }
      });

      if (error) {
        throw new Error(`Edge function error: ${error.message}`);
      }

      // Process results
      const result: RepairResult = {
        success: data.success,
        results: data.results,
        error: data.error,
        message: data.message
      };

      setResults(result);

      // Log the completion of the repair
      await logEvent(
        LogEventType.MEDIA_REPAIR_COMPLETED,
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
        LogEventType.MEDIA_REPAIR_FAILED,
        'unified-media-repair',
        {
          operation: 'unified_media_repair',
          options,
          status: 'failed',
          error: error.message
        }
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

  const checkMediaFiles = async (options: RepairOptions = {}): Promise<RepairResult> => {
    return repairMedia({
      ...options,
      checkStorageOnly: true
    });
  };

  const forceRedownload = async (messageIds: string[]): Promise<RepairResult> => {
    return repairMedia({
      messageIds,
      forceRedownload: true,
      fixContentTypes: true
    });
  };

  const repairStoragePaths = async (messageIds?: string[], limit?: number): Promise<RepairResult> => {
    return repairMedia({
      messageIds,
      limit,
      storagePathOnly: true,
      fixContentTypes: true
    });
  };

  return {
    isRepairing,
    results,
    repairMedia,
    checkMediaFiles,
    forceRedownload,
    repairStoragePaths
  };
}
