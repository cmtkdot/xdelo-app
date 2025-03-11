
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';
import { useStuckMessageRepair } from './useStuckMessageRepair';
import { useMediaGroupRepair } from './useMediaGroupRepair';
import { useMediaRecovery } from './useMediaRecovery';
import { useProcessingStats } from './useProcessingStats';

export function useProcessingSystemRepair() {
  const [isRepairing, setIsRepairing] = useState(false);
  const { toast } = useToast();
  const { repairStuckMessages } = useStuckMessageRepair();
  const { repairMessageProcessingSystem } = useMediaGroupRepair();
  const { validateStorageFiles } = useMediaRecovery();
  const { getProcessingStats } = useProcessingStats();

  const repairProcessingSystem = async () => {
    try {
      setIsRepairing(true);
      
      // Call the repair operation through the unified endpoint with extensive configuration
      const { data, error } = await supabase.functions.invoke('media-management', {
        body: { 
          action: 'repair-processing-flow',
          limit: 100,
          options: {
            repairEnums: true,
            resetAll: true,
            forceResetStalled: true
          }
        }
      });
      
      if (error) throw error;
      
      toast({
        title: "System Repair Complete",
        description: `System diagnostics and repairs completed successfully.`
      });
      
      return data;
    } catch (error: any) {
      console.error('Error repairing processing system:', error);
      
      toast({
        title: "Repair Failed",
        description: error.message || "Failed to repair processing system",
        variant: "destructive"
      });
      
      throw error;
    } finally {
      setIsRepairing(false);
    }
  };

  return {
    repairProcessingSystem,
    repairStuckMessages,
    repairMediaGroups: repairMessageProcessingSystem,
    validateStorageFiles,
    isRepairing,
    getProcessingStats
  };
}
