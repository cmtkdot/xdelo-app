
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';

export function useMediaGroupRepair() {
  const { toast } = useToast();

  // Repair any issues with the queue system and message relationships
  const repairMessageProcessingSystem = async () => {
    try {
      // First repair media group relationships
      const { data: repairResult, error: repairError } = await supabase.functions.invoke(
        'direct-media-group-repair',
        {
          body: { 
            correlation_id: crypto.randomUUID(),
            repair_type: 'full'
          }
        }
      );
      
      if (repairError) throw repairError;
      
      toast({
        title: "Media Group Repair Complete",
        description: `Fixed ${repairResult?.fixed_count || 0} media group relationships.`
      });
      
      // Then run the standard repair process using the process message queue function
      const { data: processResult, error: processError } = await supabase.functions.invoke(
        'scheduler-process-queue',
        {
          body: { 
            limit: 20,
            trigger_source: 'manual',
            repair: true
          }
        }
      );
      
      if (processError) throw processError;
      
      return { 
        success: true, 
        media_group_fix: repairResult?.fixed_count || 0,
        process_result: processResult
      };
    } catch (error: any) {
      console.error('Error repairing system:', error);
      
      toast({
        title: "Repair Failed",
        description: error.message || "Failed to repair message processing system",
        variant: "destructive"
      });
      
      throw error;
    }
  };

  return {
    repairMessageProcessingSystem
  };
}
