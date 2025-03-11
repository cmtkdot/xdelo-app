
import { useCallback, useState } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { toast } from 'sonner';

export function useSystemHealthMonitor() {
  const supabase = useSupabaseClient();
  const [isRepairing, setIsRepairing] = useState(false);

  const repairMessageProcessingSystem = useCallback(async () => {
    try {
      setIsRepairing(true);
      
      // Call the repair function
      const { data, error } = await supabase.rpc('xdelo_repair_processing_flow', { 
        p_limit: 20, 
        p_correlation_id: null 
      });
      
      if (error) {
        throw error;
      }
      
      // Call the repair media groups function
      const { data: mediaGroupData, error: mediaGroupError } = await supabase.rpc('xdelo_repair_media_group_syncs');
      
      if (mediaGroupError) {
        toast.error('Error repairing media groups: ' + mediaGroupError.message);
      }
      
      toast.success('Processing system repaired successfully');
      return {
        success: true,
        media_group_fix: mediaGroupData,
        process_result: data
      };
    } catch (error: any) {
      toast.error('Failed to repair processing system: ' + error.message);
      return {
        success: false,
        error: error?.message
      };
    } finally {
      setIsRepairing(false);
    }
  }, [supabase]);

  const repairMediaGroups = useCallback(async () => {
    try {
      setIsRepairing(true);
      
      // Call the repair media groups function
      const { data, error } = await supabase.rpc('xdelo_repair_media_group_syncs');
      
      if (error) {
        throw error;
      }
      
      toast.success('Media groups repaired successfully');
      return {
        success: true,
        result: data
      };
    } catch (error: any) {
      toast.error('Failed to repair media groups: ' + error.message);
      return {
        success: false,
        error: error?.message
      };
    } finally {
      setIsRepairing(false);
    }
  }, [supabase]);

  return {
    repairMessageProcessingSystem,
    repairMediaGroups,
    isRepairing
  };
}
