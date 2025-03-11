
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';

export function useStuckMessageRepair() {
  const [isRepairing, setIsRepairing] = useState(false);
  const { toast } = useToast();

  /**
   * Resets and repairs messages stuck in processing state
   */
  const repairStuckMessages = async () => {
    try {
      setIsRepairing(true);
      
      // Call the repair function through the unified endpoint
      const { data, error } = await supabase.functions.invoke('media-management', {
        body: { 
          action: 'repair-processing-flow',
          limit: 50, 
          options: {
            repairEnums: true,
            forceResetStalled: true
          }
        }
      });
      
      if (error) throw error;
      
      const results = data?.data?.results || {};
      
      toast({
        title: "Recovery Process Complete",
        description: `Reset ${results.stuck_reset || 0} stalled messages and fixed ${results.media_groups_fixed || 0} media groups.`
      });
      
      return data;
    } catch (error: any) {
      console.error('Error repairing stuck messages:', error);
      
      toast({
        title: "Repair Failed",
        description: error.message || "Failed to repair stuck messages",
        variant: "destructive"
      });
      
      throw error;
    } finally {
      setIsRepairing(false);
    }
  };

  return {
    repairStuckMessages,
    isRepairing
  };
}
