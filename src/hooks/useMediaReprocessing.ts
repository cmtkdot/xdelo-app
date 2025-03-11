
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
      
      toast({
        title: "Content Disposition Fixed",
        description: `Successfully updated ${data?.data?.repaired || 0} files to display inline.`
      });
      
      return data;
    } catch (error: any) {
      console.error('Error fixing content disposition:', error);
      
      toast({
        title: "Fix Failed",
        description: error.message || "Failed to fix content disposition",
        variant: "destructive"
      });
      
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
      
      toast({
        title: "Storage Paths Repaired",
        description: `Fixed ${data?.data?.repaired || 0} storage paths.`
      });
      
      return data;
    } catch (error: any) {
      console.error('Error repairing storage paths:', error);
      
      toast({
        title: "Repair Failed",
        description: error.message || "Failed to repair storage paths",
        variant: "destructive"
      });
      
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    fixContentDisposition,
    repairStoragePaths,
    isProcessing
  };
}
