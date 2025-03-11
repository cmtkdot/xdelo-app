
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';

/**
 * Hook to reprocess existing media in the system to ensure proper display
 */
export function useMediaReprocessing() {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  /**
   * Reprocess the contentDisposition for specific files
   */
  const fixContentDisposition = async (messageIds?: string[]) => {
    try {
      setIsProcessing(true);
      
      const { data, error } = await supabase.functions.invoke('repair-storage-paths', {
        body: { 
          messageIds,
          fixContentDisposition: true
        }
      });
      
      if (error) throw error;
      
      console.log("Content disposition fixed result:", data);
      
      return data;
    } catch (error: any) {
      console.error('Error fixing content disposition:', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Repair all storage paths for consistency and proper extension mapping
   */
  const repairStoragePaths = async (messageIds?: string[]) => {
    try {
      setIsProcessing(true);
      
      const { data, error } = await supabase.functions.invoke('repair-storage-paths', {
        body: { 
          messageIds
        }
      });
      
      if (error) throw error;
      
      console.log("Storage paths repair result:", data);
      
      return data;
    } catch (error: any) {
      console.error('Error repairing storage paths:', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Redownload a specific file from its media group
   */
  const redownloadFromMediaGroup = async (messageId: string, mediaGroupId?: string) => {
    try {
      setIsProcessing(true);
      
      const { data, error } = await supabase.functions.invoke('redownload-from-media-group', {
        body: { 
          messageId,
          mediaGroupId
        }
      });
      
      if (error) throw error;
      
      console.log("Redownload result:", data);
      
      return data;
    } catch (error: any) {
      console.error('Error redownloading file:', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    fixContentDisposition,
    repairStoragePaths,
    redownloadFromMediaGroup,
    isProcessing
  };
}
