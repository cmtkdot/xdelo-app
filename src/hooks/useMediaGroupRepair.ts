
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';

export function useMediaGroupRepair() {
  const [isRepairing, setIsRepairing] = useState(false);
  const { toast } = useToast();

  const repairMessageProcessingSystem = async () => {
    try {
      setIsRepairing(true);
      
      // Call the repair function
      const { data, error } = await supabase.rpc('xdelo_repair_media_group_syncs', {});
      
      if (error) throw error;
      
      toast({
        title: "Media Group Repair Complete",
        description: `Fixed ${data.length || 0} media groups with sync issues.`
      });
      
      return data;
    } catch (error: any) {
      console.error('Error running system maintenance:', error);
      
      toast({
        title: "Repair Failed",
        description: error.message || "Failed to repair media groups",
        variant: "destructive"
      });
      
      throw error;
    } finally {
      setIsRepairing(false);
    }
  };

  return {
    repairMessageProcessingSystem,
    isRepairing
  };
}
