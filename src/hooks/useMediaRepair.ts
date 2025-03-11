
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';

export function useMediaRepair() {
  const [isRepairing, setIsRepairing] = useState(false);
  const { toast } = useToast();

  /**
   * Repair a media file by redownloading it
   */
  const repairMedia = async (messageId: string) => {
    setIsRepairing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('redownload-missing-files', {
        body: { messageId }
      });
      
      if (error) throw new Error(error.message);
      
      toast({
        title: "Media repair initiated",
        description: "The media file repair process has been started.",
      });
      
      return data;
    } catch (error) {
      console.error('Media repair failed:', error);
      toast({
        title: "Media repair failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsRepairing(false);
    }
  };

  return {
    repairMedia,
    isRepairing
  };
}
