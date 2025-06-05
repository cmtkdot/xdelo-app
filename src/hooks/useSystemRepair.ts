
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';

export interface RepairOptions {
  fixStoragePaths?: boolean;
  fixMimeTypes?: boolean;
  fixProcessingStates?: boolean;
  redownloadMissing?: boolean;
  syncMediaGroups?: boolean;
  limit?: number;
}

export function useSystemRepair() {
  const [isRepairing, setIsRepairing] = useState(false);
  const [results, setResults] = useState<any>(null);
  const { toast } = useToast();

  const repairSystem = async (options: RepairOptions = {}) => {
    setIsRepairing(true);
    setResults(null);

    try {
      const { data, error } = await supabase.functions.invoke('xdelo_repair_media', {
        body: {
          options: {
            ...options,
            comprehensive: true
          }
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      setResults(data);
      toast({
        title: "System Repair Complete",
        description: "The system repair process has completed successfully.",
      });
      return data;
    } catch (error: any) {
      console.error("Error repairing system:", error);
      toast({
        title: "System Repair Failed",
        description: error.message || "An error occurred during system repair",
        variant: "destructive",
      });
      setResults({ error: error.message });
      return { error: error.message };
    } finally {
      setIsRepairing(false);
    }
  };

  const repairProcessingSystem = async (options: RepairOptions = {}) => {
    setIsRepairing(true);
    setResults(null);

    try {
      const { data, error } = await supabase.functions.invoke('xdelo_file_repair', {
        body: {
          options: {
            ...options,
            fixProcessingStates: true
          }
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      setResults(data);
      toast({
        title: "Processing System Repair Complete",
        description: "Processing states have been reset and fixed.",
      });
      return data;
    } catch (error: any) {
      console.error("Error repairing processing system:", error);
      toast({
        title: "Processing Repair Failed",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
      setResults({ error: error.message });
      return { error: error.message };
    } finally {
      setIsRepairing(false);
    }
  };

  const resetStalledProcessing = async () => {
    setIsRepairing(true);
    setResults(null);

    try {
      const { data, error } = await supabase.functions.invoke('xdelo_file_repair', {
        body: {
          options: {
            resetStalled: true,
            stalledThresholdMinutes: 30
          }
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      setResults(data);
      toast({
        title: "Stalled Processing Reset",
        description: `${data.resetCount || 0} stalled messages were reset.`,
      });
      return data;
    } catch (error: any) {
      console.error("Error resetting stalled processing:", error);
      toast({
        title: "Reset Failed",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
      setResults({ error: error.message });
      return { error: error.message };
    } finally {
      setIsRepairing(false);
    }
  };

  return {
    isRepairing,
    results,
    repairSystem,
    repairProcessingSystem,
    resetStalledProcessing
  };
}
