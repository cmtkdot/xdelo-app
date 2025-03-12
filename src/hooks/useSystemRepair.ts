
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';

interface RepairOptions {
  limit?: number;
  repair_enums?: boolean;
  reset_all?: boolean;
  force_reset_stalled?: boolean;
}

export function useSystemRepair() {
  const [isRepairing, setIsRepairing] = useState(false);
  const [results, setResults] = useState<any>(null);
  const { toast } = useToast();

  const repairProcessingSystem = async (options: RepairOptions = {}) => {
    try {
      setIsRepairing(true);
      
      const { data, error } = await supabase.functions.invoke('repair-processing-flow', {
        body: {
          limit: options.limit || 20,
          repair_enums: options.repair_enums !== false,
          reset_all: options.reset_all || false,
          force_reset_stalled: options.force_reset_stalled || false
        }
      });
      
      if (error) throw error;
      
      toast({
        title: "System Repair Complete",
        description: `Fixed ${data.results.stuck_reset + data.results.initialized_processed} messages`
      });
      
      setResults(data.results);
      return data;
    } catch (error) {
      console.error('Error in system repair:', error);
      
      toast({
        title: "Repair Failed",
        description: error instanceof Error ? error.message : "Failed to repair processing system",
        variant: "destructive"
      });
      
      throw error;
    } finally {
      setIsRepairing(false);
    }
  };

  const resetStalledProcessing = async () => {
    return repairProcessingSystem({ force_reset_stalled: true });
  };

  return {
    isRepairing,
    results,
    repairProcessingSystem,
    resetStalledProcessing
  };
}
