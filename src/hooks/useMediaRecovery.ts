
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';

/**
 * Hook for managing media recovery operations
 */
export function useMediaRecovery() {
  const [isRecovering, setIsRecovering] = useState(false);
  const { toast } = useToast();

  /**
   * Redownload files for specified messages
   */
  const redownloadFiles = async (messageIds?: string[], mediaGroupId?: string) => {
    try {
      setIsRecovering(true);
      
      const { data, error } = await supabase.functions.invoke('media-management', {
        body: { 
          action: 'redownload',
          messageIds,
          mediaGroupId
        }
      });
      
      if (error) throw error;
      
      toast({
        title: "Files Redownloaded",
        description: `Successfully redownloaded ${data?.data?.successful || 0} files.`
      });
      
      return data;
    } catch (error: any) {
      console.error('Error redownloading files:', error);
      
      toast({
        title: "Redownload Failed",
        description: error.message || "Failed to redownload files",
        variant: "destructive"
      });
      
      throw error;
    } finally {
      setIsRecovering(false);
    }
  };

  /**
   * Validate storage paths and redownload missing files
   */
  const validateStorageFiles = async (limit = 50, onlyNewest = true) => {
    try {
      setIsRecovering(true);
      
      const { data, error } = await supabase.functions.invoke('media-management', {
        body: { 
          action: 'validate',
          limit,
          options: {
            onlyNewest
          }
        }
      });
      
      if (error) throw error;
      
      toast({
        title: "Storage Validation Complete",
        description: `Validated ${data?.data?.processed || 0} files, ${data?.data?.invalid || 0} need redownload.`
      });
      
      return data;
    } catch (error: any) {
      console.error('Error validating storage files:', error);
      
      toast({
        title: "Validation Failed",
        description: error.message || "Failed to validate storage files",
        variant: "destructive"
      });
      
      throw error;
    } finally {
      setIsRecovering(false);
    }
  };

  /**
   * Repair storage paths
   */
  const repairStoragePaths = async (messageIds?: string[]) => {
    try {
      setIsRecovering(true);
      
      const { data, error } = await supabase.functions.invoke('media-management', {
        body: { 
          action: 'repair-storage-paths',
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
      setIsRecovering(false);
    }
  };

  return {
    redownloadFiles,
    validateStorageFiles,
    repairStoragePaths,
    isRecovering
  };
}
