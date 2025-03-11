
import { useState, useCallback } from 'react';
import { supabase } from '../integrations/supabase/client';
import { toast } from 'sonner';

// Define a type for the repair results
interface RepairResult {
  results?: {
    stuck_reset?: number;
    media_groups_fixed?: number;
  };
  success?: boolean;
  message?: string;
}

/**
 * Custom hook for repairing the system
 */
export function useSystemRepair() {
  const [isRepairing, setIsRepairing] = useState(false);

  /**
   * Repair the processing system by invoking the edge function
   */
  const repairProcessingSystem = useCallback(async () => {
    try {
      setIsRepairing(true);
      
      const { data, error } = await supabase.functions.invoke(
        'repair-processing-flow',
        {
          body: { 
            limit: 20,
            repair_enums: true,
            force_reset_stalled: true,
            trigger_source: 'manual_ui'
          }
        }
      );
      
      if (error) throw error;
      
      const resetCount = data?.results?.stuck_reset || 0;
      const mediaGroupsFixed = data?.results?.media_groups_fixed || 0;
      
      toast.success(`System repair completed: Reset ${resetCount} stuck messages and fixed ${mediaGroupsFixed} media groups`);
      return data as RepairResult;
    } catch (error) {
      console.error('Failed to repair processing system:', error);
      toast.error('Failed to repair processing system');
      return null;
    } finally {
      setIsRepairing(false);
    }
  }, []);

  return { repairProcessingSystem, isRepairing };
}
