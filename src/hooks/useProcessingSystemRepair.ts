
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/useToast';
import { useProcessingStats } from './useProcessingStats';

export interface RepairOptions {
  limit?: number;
  reset_all?: boolean;
  repair_enums?: boolean;
  force_reset_stalled?: boolean;
}

const useProcessingSystemRepair = () => {
  const [isRepairing, setIsRepairing] = useState(false);
  const [results, setResults] = useState<any>(null);
  const { toast } = useToast();
  const { refetch } = useProcessingStats();

  const repairProcessingSystem = async (options: RepairOptions = {}) => {
    try {
      setIsRepairing(true);
      
      // Call the edge function to repair the processing system
      const { data, error } = await supabase.functions.invoke('repair-processing-flow', {
        body: {
          limit: options.limit || 20,
          reset_all: options.reset_all || false,
          repair_enums: options.repair_enums !== false, // Default to true
          force_reset_stalled: options.force_reset_stalled || false
        }
      });
      
      if (error) throw error;
      
      setResults(data);
      
      // Refresh stats after repair
      await refetch();
      
      toast({
        title: 'System Repair Completed',
        description: `Successfully repaired the processing system. ${data?.results?.stuck_reset || 0} stuck messages reset.`,
      });
      
      return data;
    } catch (err: any) {
      console.error('Error repairing processing system:', err);
      
      toast({
        title: 'Repair Failed',
        description: err.message || 'An unexpected error occurred',
        variant: 'destructive'
      });
      
      throw err;
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
};

export default useProcessingSystemRepair;
