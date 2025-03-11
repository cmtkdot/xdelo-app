
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/useToast';

export function useMediaRepair() {
  const [isRepairing, setIsRepairing] = useState(false);
  const { toast } = useToast();

  const repairMedia = async (messageId: string) => {
    setIsRepairing(true);
    try {
      const { data, error } = await supabase.functions.invoke('repair-storage-paths', {
        body: { messageId }
      });
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error repairing media:', error);
      throw error;
    } finally {
      setIsRepairing(false);
    }
  };

  const repairMissingMediaFiles = async () => {
    setIsRepairing(true);
    try {
      const { data, error } = await supabase.functions.invoke('redownload-missing-files', {
        body: {}
      });
      
      if (error) throw error;
      return data || { fixed: 0, errors: 0 };
    } catch (error) {
      console.error('Error repairing missing media files:', error);
      throw error;
    } finally {
      setIsRepairing(false);
    }
  };

  return {
    repairMedia,
    repairMissingMediaFiles,
    isRepairing
  };
}
