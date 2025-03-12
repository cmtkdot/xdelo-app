
import { useState } from 'react';
import { useSupabaseClient } from '@/integrations/supabase/client';
import { useToast } from './useToast';

interface RepairOptions {
  messageIds?: string[];
  forceRedownload?: boolean;
}

export function useFileRepair() {
  const [isRepairing, setIsRepairing] = useState(false);
  const [results, setResults] = useState<any>(null);
  const { toast } = useToast();
  const supabaseClient = useSupabaseClient();

  const repairFileReferences = async (options: RepairOptions = {}) => {
    try {
      setIsRepairing(true);
      const { data, error } = await supabaseClient.functions.invoke('xdelo_file_repair', {
        body: {
          messageIds: options.messageIds,
          forceRedownload: options.forceRedownload
        }
      });

      if (error) {
        throw error;
      }

      setResults(data);
      toast({
        title: 'File repair complete',
        description: `Processed ${data.processedCount} files with ${data.successCount} successes and ${data.errorCount} errors.`
      });
      return data;
    } catch (error) {
      toast({
        title: 'File repair failed',
        description: error.message,
        variant: 'destructive'
      });
      console.error('File repair error:', error);
      return null;
    } finally {
      setIsRepairing(false);
    }
  };

  return {
    isRepairing,
    results,
    repairFileReferences
  };
}
