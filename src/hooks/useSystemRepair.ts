
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
  const [lastRepairResult, setLastRepairResult] = useState<RepairResult | null>(null);

  /**
   * Repair the processing system by invoking the edge function
   */
  const repairProcessingSystem = useCallback(async (options = { limit: 20, force_reset_stalled: true }) => {
    try {
      setIsRepairing(true);
      
      const { data, error } = await supabase.functions.invoke(
        'repair-processing-flow',
        {
          body: { 
            limit: options.limit,
            repair_enums: true,
            force_reset_stalled: options.force_reset_stalled,
            trigger_source: 'manual_ui'
          }
        }
      );
      
      if (error) throw error;
      
      const resetCount = data?.results?.stuck_reset || 0;
      const mediaGroupsFixed = data?.results?.media_groups_fixed || 0;
      
      const result = {
        results: {
          stuck_reset: resetCount,
          media_groups_fixed: mediaGroupsFixed
        },
        success: true,
        message: `System repair completed: Reset ${resetCount} stuck messages and fixed ${mediaGroupsFixed} media groups`
      };
      
      setLastRepairResult(result);
      toast.success(result.message);
      return result;
    } catch (error) {
      console.error('Failed to repair processing system:', error);
      const errorResult = {
        success: false,
        message: `Failed to repair processing system: ${error.message}`
      };
      setLastRepairResult(errorResult);
      toast.error(errorResult.message);
      return errorResult;
    } finally {
      setIsRepairing(false);
    }
  }, []);

  return { 
    repairProcessingSystem, 
    isRepairing,
    lastRepairResult
  };
}
