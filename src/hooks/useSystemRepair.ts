
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';
import { logSyncOperation } from '@/lib/syncUtils';

export function useSystemRepair() {
  const [isRepairing, setIsRepairing] = useState(false);
  const { toast } = useToast();

  /**
   * Reset stuck messages in the processing state and clean up legacy queue entries
   */
  const repairProcessingSystem = async () => {
    try {
      setIsRepairing(true);
      
      // Step 1: Call the repair system edge function
      const { data, error } = await supabase.functions.invoke(
        'repair-processing-flow',
        { 
          body: { 
            limit: 20,
            repair_enums: true
          } 
        }
      );
      
      if (error) throw error;
      
      // Step 2: Force direct processing on pending messages
      const { data: schedulerData, error: schedulerError } = await supabase.functions.invoke(
        'scheduler-process-queue',
        {
          body: { 
            limit: 20,
            trigger_source: 'manual',
            repair: true
          }
        }
      );
      
      if (schedulerError) throw schedulerError;
      
      // Step 3: Direct database update for any remaining stuck messages
      const { error: updateError } = await supabase.rpc('xdelo_reset_stalled_messages');
      
      if (updateError) {
        // Non-fatal error, log but continue
        console.warn('Warning during stalled message reset:', updateError);
      }
      
      const processedCount = data?.data?.processed || 0;
      const schedulerResults = schedulerData?.result || {};
      
      toast({
        title: "Processing System Repaired",
        description: `Successfully repaired ${processedCount} stuck messages and optimized the processing system.`,
      });
      
      // Log the successful repair operation
      // Cast to any to avoid type issues with the logSyncOperation function
      await logSyncOperation(
        supabase as any,
        'processing_system_repair',
        {
          processed_count: processedCount,
          scheduler_results: schedulerResults,
          timestamp: new Date().toISOString()
        },
        true
      );
      
      return { 
        success: true, 
        processed: processedCount,
        scheduler_results: schedulerResults
      };
      
    } catch (error: any) {
      console.error('Error repairing processing system:', error);
      
      toast({
        title: "Repair Failed",
        description: error.message || "Failed to repair processing system",
        variant: "destructive"
      });
      
      // Log the failed repair attempt
      // Cast to any to avoid type issues with the logSyncOperation function
      await logSyncOperation(
        supabase as any,
        'processing_system_repair',
        {
          error: error.message,
          timestamp: new Date().toISOString()
        },
        false,
        error.message
      );
      
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
