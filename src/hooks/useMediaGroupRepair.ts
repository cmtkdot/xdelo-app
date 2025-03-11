
import { useState } from 'react';
import { useToast } from './useToast';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook for repairing media groups that may have syncing issues
 */
export function useMediaGroupRepair() {
  const [isRepairing, setIsRepairing] = useState(false);
  const { toast } = useToast();

  /**
   * Repairs the message processing system by fixing media group relationships
   */
  const repairMessageProcessingSystem = async () => {
    try {
      setIsRepairing(true);
      
      const { data, error } = await supabase.functions.invoke('xdelo_sync_media_group', {
        body: { 
          operation: 'repair_all',
          trigger_source: 'manual_ui'
        }
      });
      
      if (error) throw error;
      
      toast({
        title: "Repair Completed",
        description: "Media group relationships were successfully repaired"
      });
      
      return data;
    } catch (error: any) {
      console.error('Error repairing media groups:', error);
      
      toast({
        title: "Repair Failed",
        description: error.message || "Failed to repair media group relationships",
        variant: "destructive"
      });
      
      return null;
    } finally {
      setIsRepairing(false);
    }
  };

  /**
   * Repairs a specific media group
   */
  const repairSpecificMediaGroup = async (mediaGroupId: string, sourceMessageId?: string) => {
    try {
      setIsRepairing(true);
      
      const { data, error } = await supabase.functions.invoke('xdelo_sync_media_group', {
        body: { 
          media_group_id: mediaGroupId,
          source_message_id: sourceMessageId,
          operation: 'repair_specific',
          trigger_source: 'manual_ui'
        }
      });
      
      if (error) throw error;
      
      toast({
        title: "Group Repair Completed",
        description: `Media group ${mediaGroupId.substring(0, 8)}... was successfully repaired`
      });
      
      return data;
    } catch (error: any) {
      console.error(`Error repairing media group ${mediaGroupId}:`, error);
      
      toast({
        title: "Group Repair Failed",
        description: error.message || "Failed to repair the specified media group",
        variant: "destructive"
      });
      
      return null;
    } finally {
      setIsRepairing(false);
    }
  };

  return {
    repairMessageProcessingSystem,
    repairSpecificMediaGroup,
    isRepairing
  };
}
