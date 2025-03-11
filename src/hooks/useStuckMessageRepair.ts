
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
      
      // Call the dedicated repair function via edge function
      const { data, error } = await supabase.functions.invoke('repair-processing-flow', {
        body: { 
          limit: 50, 
          repair_enums: true,
          repair_stalled: true
        }
      });
      
      if (error) throw error;
      
      toast({
        title: "Recovery Process Complete",
        description: `Reset ${data?.data?.processed || 0} stalled messages and fixed ${data?.data?.media_groups_fixed?.mixed_groups_fixed || 0} media groups.`
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
