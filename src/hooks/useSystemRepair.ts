
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

  // Add the repairSystem function to fix the missing function error
  const repairSystem = async (options: RepairOptions = {}) => {
    setIsRepairing(true);
    setResults(null);

    try {
      const { data, error } = await supabase.functions.invoke('repair-media', {
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
      const { data, error } = await supabase.functions.invoke('file_repair', {
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
      const { data, error } = await supabase.functions.invoke('file_repair', {
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

  const cleanupLegacyFunctions = async () => {
    setIsRepairing(true);
    setResults(null);

    try {
      const { data, error } = await supabase.functions.invoke('cleanup_legacy_functions', {
        body: {}
      });

      if (error) {
        throw new Error(error.message);
      }

      setResults(data);
      toast({
        title: "Legacy Functions Cleanup Complete",
        description: "Unused legacy functions have been removed.",
      });
      return data;
    } catch (error: any) {
      console.error("Error cleaning up legacy functions:", error);
      toast({
        title: "Cleanup Failed",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
      setResults({ error: error.message });
      return { error: error.message };
    } finally {
      setIsRepairing(false);
    }
  };

  const analyzeDatabaseFunctions = async () => {
    setIsRepairing(true);
    setResults(null);

    try {
      const { data, error } = await supabase.functions.invoke('migrate_db_functions', {
        body: { mode: 'analyze' }
      });

      if (error) {
        throw new Error(error.message);
      }

      setResults(data);
      toast({
        title: "Database Function Analysis Complete",
        description: `Analyzed ${data.results?.total_functions || 0} database functions.`,
      });
      return data;
    } catch (error: any) {
      console.error("Error analyzing database functions:", error);
      toast({
        title: "Analysis Failed",
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
    resetStalledProcessing,
    cleanupLegacyFunctions,
    analyzeDatabaseFunctions
  };
}
