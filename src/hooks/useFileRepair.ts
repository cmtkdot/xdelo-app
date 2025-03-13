
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';
import { logEvent } from '@/lib/logUtils';
import LogEventType from '@/types/api/LogEventType';

interface FileRepairOptions {
  messageIds?: string[];
  limit?: number;
  forceRedownload?: boolean;
  fixContentType?: boolean;
}

interface FileRepairResult {
  success: boolean;
  message?: string;
  repaired?: number;
  processed?: number;
  failed?: number;
  details?: any[];
}

export function useFileRepair() {
  const [isRepairing, setIsRepairing] = useState(false);
  const [results, setResults] = useState<FileRepairResult | null>(null);
  const { toast } = useToast();

  const repairFiles = async (options: FileRepairOptions): Promise<FileRepairResult> => {
    try {
      setIsRepairing(true);
      
      // Log the repair attempt
      await logEvent(
        LogEventType.MEDIA_REPAIR_STARTED,
        'file-repair',
        {
          options,
          status: 'started'
        }
      );

      // Call the edge function
      const { data, error } = await supabase.functions.invoke('xdelo_file_repair', {
        body: {
          messageIds: options.messageIds,
          limit: options.limit || 50,
          forceRedownload: options.forceRedownload || false,
          fixContentType: options.fixContentType || true
        }
      });

      if (error) {
        throw new Error(`Edge function error: ${error.message}`);
      }

      // Process results
      const result: FileRepairResult = {
        success: data.success,
        message: data.message,
        repaired: data.repaired,
        processed: data.processed,
        failed: data.failed,
        details: data.details
      };

      setResults(result);

      // Log the completion of the repair
      await logEvent(
        LogEventType.MEDIA_REPAIR_COMPLETED,
        'file-repair',
        {
          options,
          status: 'completed',
          results: result
        }
      );

      // Show a toast with the results
      toast({
        title: 'File Repair Complete',
        description: `Processed ${data.processed} files: ${data.repaired} repaired, ${data.failed} failed.`
      });

      return result;
    } catch (error) {
      console.error('File repair error:', error);

      // Log the error
      await logEvent(
        LogEventType.MEDIA_REPAIR_FAILED,
        'file-repair',
        {
          options,
          status: 'failed',
          error: error.message
        }
      );

      // Show error toast
      toast({
        title: 'File Repair Failed',
        description: error.message,
        variant: 'destructive'
      });

      const errorResult: FileRepairResult = {
        success: false,
        message: error.message
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
    repairFiles
  };
}

export default useFileRepair;
