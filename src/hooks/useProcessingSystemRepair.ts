
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';

export function useProcessingSystemRepair() {
  const [isRepairing, setIsRepairing] = useState(false);
  const { toast } = useToast();

  const repairProcessingSystem = async (options?: { limit?: number }) => {
    try {
      setIsRepairing(true);
      
      const { data, error } = await supabase.functions.invoke(
        'repair-processing-flow',
        {
          body: { 
            limit: options?.limit || 50,
            repair_enums: true,
            reset_all: false,
            force_reset_stalled: true
          }
        }
      );
      
      if (error) throw error;
      
      toast({
        title: "Processing System Repaired",
        description: `Fixed ${data.results.stuck_reset} stuck messages and ${data.results.media_groups_fixed} media groups.`
      });
      
      return data;
    } catch (error) {
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
    isRepairing
  };
}
