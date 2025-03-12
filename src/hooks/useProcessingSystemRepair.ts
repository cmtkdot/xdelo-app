
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';

interface RepairOptions {
  limit?: number;
  repair_enums?: boolean;
  reset_all?: boolean;
  force_reset_stalled?: boolean;
}

export function useProcessingSystemRepair() {
  const [isRepairing, setIsRepairing] = useState(false);
  const { toast } = useToast();

  const repairProcessingFlow = async (options?: RepairOptions) => {
    setIsRepairing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('repair-processing-flow', {
        body: {
          limit: options?.limit || 20,
          repair_enums: options?.repair_enums !== undefined ? options.repair_enums : true,
          reset_all: options?.reset_all || false,
          force_reset_stalled: options?.force_reset_stalled || false
        }
      });
      
      if (error) {
        throw new Error(`Error repairing processing flow: ${error.message}`);
      }
      
      toast({
        title: "System repair completed",
        description: data.message || "Processing system repair completed successfully",
      });
      
      return data;
    } catch (error: any) {
      toast({
        title: "System repair failed",
        description: error.message || "An error occurred during system repair",
        variant: "destructive",
      });
      
      throw error;
    } finally {
      setIsRepairing(false);
    }
  };
  
  return {
    repairProcessingFlow,
    isRepairing
  };
}
