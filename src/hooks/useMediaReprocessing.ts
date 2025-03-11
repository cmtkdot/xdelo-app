
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';

export function useMediaReprocessing() {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const redownloadFromMediaGroup = async (messageId: string) => {
    try {
      setIsProcessing(true);
      const { data, error } = await supabase.functions.invoke('redownload-from-media-group', {
        body: { 
          messageId,
          correlationId: crypto.randomUUID()
        }
      });

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error redownloading from media group:', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    redownloadFromMediaGroup,
    isProcessing
  };
}
