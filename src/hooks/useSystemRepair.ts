
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';
import { useMediaGroupRepair } from './useMediaGroupRepair';
import { useStuckMessageRepair } from './useStuckMessageRepair';
import { useMediaRecovery } from './useMediaRecovery';
import { useMessageQueue } from './useMessageQueue';

/**
 * Consolidated hook for system repair and maintenance operations
 */
export function useSystemRepair() {
  const [isRepairing, setIsRepairing] = useState(false);
  const { toast } = useToast();
  
  // Import specialized repair hooks
  const { repairStuckMessages } = useStuckMessageRepair();
  const { repairMessageProcessingSystem, repairSpecificMediaGroup } = useMediaGroupRepair();
  const { validateStorageFiles, repairStoragePaths, redownloadFiles } = useMediaRecovery();
  const { processMessageQueue } = useMessageQueue();

  /**
   * Comprehensive system repair that performs all repair operations in sequence
   */
  const repairFullSystem = async () => {
    try {
      setIsRepairing(true);
      
      // Generate a correlation ID for tracking this repair session
      const correlationId = crypto.randomUUID();
      
      // Step 1: Run the processing system repair (fixes database enums, stalled messages)
      const { data: repairData, error: repairError } = await supabase.functions.invoke('media-management', {
        body: { 
          action: 'repair-processing-flow',
          limit: 100,
          options: {
            repairEnums: true,
            resetAll: true,
            forceResetStalled: true,
            correlationId
          }
        }
      });
      
      if (repairError) throw repairError;
      
      // Step 2: Repair media groups (sync content between related media)
      const { data: groupRepairData, error: groupError } = await supabase.functions.invoke('media-management', {
        body: { 
          action: 'repair-media-groups',
          options: {
            fullRepair: true,
            correlationId
          }
        }
      });
      
      if (groupError) throw groupError;
      
      // Step 3: Validate and repair storage paths
      const { data: storageData, error: storageError } = await supabase.functions.invoke('media-management', {
        body: { 
          action: 'validate',
          limit: 50,
          options: {
            repair: true,
            correlationId
          }
        }
      });
      
      if (storageError) throw storageError;
      
      // Step 4: Process any pending messages in the queue
      await processMessageQueue(20, true);
      
      // Log the repair results
      const results = {
        processingSystemRepair: repairData?.data || {},
        mediaGroupRepair: groupRepairData?.data || {},
        storageRepair: storageData?.data || {},
        correlationId
      };
      
      console.log('System repair results:', results);
      
      // Show success toast with summary of operations
      toast({
        title: "System Repair Complete",
        description: `Fixed ${repairData?.data?.reset_count || 0} stuck messages, ${groupRepairData?.data?.fixed_count || 0} media groups, and validated ${storageData?.data?.processed || 0} files.`
      });
      
      return results;
    } catch (error: any) {
      console.error('Error during system repair:', error);
      
      toast({
        title: "Repair Failed",
        description: error.message || "Failed to complete system repair",
        variant: "destructive"
      });
      
      throw error;
    } finally {
      setIsRepairing(false);
    }
  };

  /**
   * Targeted repair for a specific media group
   */
  const repairMediaGroup = async (groupId: string, sourceMessageId?: string) => {
    return repairSpecificMediaGroup(groupId, sourceMessageId);
  };

  /**
   * Quick system maintenance - handles common issues
   */
  const performQuickMaintenance = async () => {
    try {
      setIsRepairing(true);
      
      // 1. Repair stuck messages
      await repairStuckMessages();
      
      // 2. Validate most recent files (limit to 20)
      await validateStorageFiles(20, true);
      
      // 3. Process any pending messages
      await processMessageQueue(10);
      
      toast({
        title: "Quick Maintenance Complete",
        description: "Performed routine maintenance on the system."
      });
      
    } catch (error: any) {
      console.error('Error during quick maintenance:', error);
      
      toast({
        title: "Maintenance Failed",
        description: error.message || "Failed to complete maintenance",
        variant: "destructive"
      });
      
      throw error;
    } finally {
      setIsRepairing(false);
    }
  };

  return {
    repairFullSystem,
    repairMediaGroup,
    performQuickMaintenance,
    repairStuckMessages,
    repairMediaGroups: repairMessageProcessingSystem,
    validateStorageFiles,
    repairStoragePaths,
    redownloadFiles,
    processMessageQueue,
    isRepairing
  };
}
