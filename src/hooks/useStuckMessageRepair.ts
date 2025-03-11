
import { useState, useCallback } from 'react';
import { supabase } from '../integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Custom hook for repairing stuck messages
 */
export function useStuckMessageRepair() {
  const [isRepairing, setIsRepairing] = useState(false);

  /**
   * Repair stuck messages by invoking the edge function
   */
  const repairStuckMessages = useCallback(async () => {
    try {
      setIsRepairing(true);
      
      const { data, error } = await supabase.functions.invoke(
        'repair-processing-flow',
        {
          body: { 
            force_reset_stalled: true,
            repair_enums: false,
            trigger_source: 'manual_reset_stuck'
          }
        }
      );
      
      if (error) throw error;
      
      const resetCount = data?.results?.stuck_reset || 0;
      
      toast.success(`Reset ${resetCount} stuck messages`);
      return data;
    } catch (error) {
      console.error('Failed to repair stuck messages:', error);
      toast.error('Failed to repair stuck messages');
      return null;
    } finally {
      setIsRepairing(false);
    }
  }, []);

  return { repairStuckMessages, isRepairing };
}
