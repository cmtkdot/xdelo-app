
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface RepairMediaOptions {
  messageIds: string[];
  fixContentTypes?: boolean;
  forceRedownload?: boolean;
}

export function useUnifiedMediaRepair() {
  const [isRepairing, setIsRepairing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const repairMedia = async ({
    messageIds,
    fixContentTypes = true,
    forceRedownload = false
  }: RepairMediaOptions) => {
    if (!messageIds.length) return { success: false, message: 'No message IDs provided' };
    
    try {
      setIsRepairing(true);
      setError(null);
      
      const { data, error: repairError } = await supabase.functions.invoke(
        'xdelo_repair_media',
        {
          body: {
            messageIds,
            options: {
              fixContentTypes,
              forceRedownload
            }
          }
        }
      );
      
      if (repairError) {
        throw repairError;
      }
      
      return data;
    } catch (err: any) {
      console.error('Error repairing media:', err);
      setError(err);
      throw err;
    } finally {
      setIsRepairing(false);
    }
  };

  return {
    repairMedia,
    isRepairing,
    error
  };
}
