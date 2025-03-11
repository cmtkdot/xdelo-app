
import { supabase } from '@/integrations/supabase/client';
import { useProcessingRepair } from './useProcessingRepair';

export function useSystemRepair() {
  const { runRepairOperation, isRepairing } = useProcessingRepair();

  /**
   * Reset stuck messages in the processing state and clean up legacy queue entries
   */
  const repairProcessingSystem = async () => {
    return runRepairOperation(
      'processing_system_repair',
      async () => {
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
        
        return { 
          processed: processedCount,
          scheduler_results: schedulerResults
        };
      },
      "Processing System Repaired"
    );
  };

  return {
    repairProcessingSystem,
    isRepairing
  };
}
