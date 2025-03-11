
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';
import { useState } from 'react';

export function useMediaGroupRepair() {
  const { toast } = useToast();
  const [isRepairing, setIsRepairing] = useState(false);

  // Repair any issues with the media group relationships
  const repairMessageProcessingSystem = async () => {
    try {
      setIsRepairing(true);
      
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
      
      // Then run the standard repair process using the scheduler process
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
    } finally {
      setIsRepairing(false);
    }
  };

  return {
    repairMessageProcessingSystem,
    isRepairing
  };
}
