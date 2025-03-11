
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';

export function useMediaGroupRepair() {
  const [isRepairing, setIsRepairing] = useState(false);
  const { toast } = useToast();

  const repairMessageProcessingSystem = async () => {
    try {
      setIsRepairing(true);
      
      // Call the repair function through the unified endpoint
      const { data, error } = await supabase.functions.invoke('media-management', {
        body: { 
          action: 'repair-media-groups',
          options: {
            fullRepair: false
          }
        }
      });
      
      if (error) throw error;
      
      toast({
        title: "Media Group Repair Complete",
        description: `Fixed ${data?.data?.fixed_count || 0} media groups with sync issues.`
      });
      
      return data?.data;
    } catch (error: any) {
      console.error('Error running system maintenance:', error);
      
      toast({
        title: "Repair Failed",
        description: error.message || "Failed to repair media groups",
        variant: "destructive"
      });
      
      throw error;
    } finally {
      setIsRepairing(false);
    }
  };

  const repairSpecificMediaGroup = async (groupId: string, sourceMessageId?: string) => {
    try {
      setIsRepairing(true);
      
      const { data, error } = await supabase.functions.invoke('media-management', {
        body: { 
          action: 'repair-media-groups',
          mediaGroupId: groupId,
          messageIds: sourceMessageId ? [sourceMessageId] : undefined,
          options: {
            sourceMessageId
          }
        }
      });
      
      if (error) throw error;
      
      toast({
        title: "Media Group Repair Complete",
        description: `Fixed media group ${groupId} successfully.`
      });
      
      return data?.data;
    } catch (error: any) {
      console.error('Error repairing media group:', error);
      
      toast({
        title: "Repair Failed",
        description: error.message || "Failed to repair media group",
        variant: "destructive"
      });
      
      throw error;
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
