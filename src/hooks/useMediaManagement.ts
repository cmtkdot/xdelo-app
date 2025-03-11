
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';

/**
 * Comprehensive hook for all media management operations
 */
export function useMediaManagement() {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  /**
   * Execute a media management operation
   */
  const executeOperation = async (
    action: string, 
    params: any = {}, 
    successMessage: string
  ) => {
    try {
      setIsProcessing(true);
      
      const { data, error } = await supabase.functions.invoke('media-management', {
        body: { 
          action,
          ...params
        }
      });
      
      if (error) throw error;
      
      toast({
        title: "Operation Complete",
        description: successMessage
      });
      
      return data?.data;
    } catch (error: any) {
      console.error(`Error executing ${action}:`, error);
      
      toast({
        title: "Operation Failed",
        description: error.message || `Failed to execute ${action}`,
        variant: "destructive"
      });
      
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Redownload media files for specified messages
   */
  const redownloadFiles = async (messageIds?: string[], mediaGroupId?: string) => {
    const count = messageIds?.length || 'missing';
    return executeOperation(
      'redownload', 
      { messageIds, mediaGroupId }, 
      `Successfully redownloaded ${count} files.`
    );
  };

  /**
   * Validate storage files and fix issues
   */
  const validateStorage = async (limit = 50, onlyNewest = true) => {
    return executeOperation(
      'validate', 
      { limit, options: { onlyNewest } }, 
      `Validated ${limit} files and flagged missing ones for redownload.`
    );
  };

  /**
   * Repair storage paths
   */
  const repairStoragePaths = async (messageIds?: string[]) => {
    return executeOperation(
      'repair-storage-paths', 
      { messageIds }, 
      `Storage paths repaired successfully.`
    );
  };

  /**
   * Repair media group synchronization
   */
  const repairMediaGroups = async (fullRepair = false, mediaGroupId?: string, sourceMessageId?: string) => {
    return executeOperation(
      'repair-media-groups', 
      { 
        mediaGroupId, 
        messageIds: sourceMessageId ? [sourceMessageId] : undefined,
        options: { 
          fullRepair,
          sourceMessageId 
        } 
      }, 
      `Media groups repaired successfully.`
    );
  };

  /**
   * Repair processing system, including stuck messages
   */
  const repairProcessingFlow = async (resetAll = false, forceResetStalled = true) => {
    return executeOperation(
      'repair-processing-flow', 
      { 
        limit: 100,
        options: {
          repairEnums: true,
          resetAll,
          forceResetStalled
        }
      }, 
      `Processing flow repaired successfully.`
    );
  };
  
  /**
   * Run a complete system maintenance operation
   */
  const runCompleteSystemMaintenance = async () => {
    try {
      setIsProcessing(true);
      
      // 1. First repair processing flow
      await repairProcessingFlow(true, true);
      
      // 2. Then repair media groups
      await repairMediaGroups(true);
      
      // 3. Finally validate storage and repair paths
      await repairStoragePaths();
      await validateStorage(100);
      
      toast({
        title: "Complete System Maintenance Finished",
        description: "All maintenance operations completed successfully."
      });
      
      return true;
    } catch (error: any) {
      console.error('Error running complete system maintenance:', error);
      toast({
        title: "Maintenance Failed",
        description: error.message || "System maintenance process encountered errors",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    executeOperation,
    redownloadFiles,
    validateStorage,
    repairStoragePaths,
    repairMediaGroups,
    repairProcessingFlow,
    runCompleteSystemMaintenance,
    isProcessing
  };
}
