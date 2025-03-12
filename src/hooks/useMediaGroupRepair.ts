
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';

export function useMediaGroupRepair() {
  const [isRepairing, setIsRepairing] = useState(false);
  const { toast } = useToast();

  // Repair a specific media group
  const repairMediaGroup = async (mediaGroupId: string, sourceMessageId?: string) => {
    try {
      setIsRepairing(true);
      
      // Call the edge function to repair this media group
      const { data, error } = await supabase.functions.invoke(
        'direct-media-group-repair',
        {
          body: { 
            repair_type: 'specific',
            group_id: mediaGroupId,
            message_id: sourceMessageId
          }
        }
      );
      
      if (error) throw error;
      
      toast({
        title: "Media Group Repaired",
        description: `Successfully repaired media group with ${data.fixed_count} messages.`
      });
      
      return data;
    } catch (error) {
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
  
  // Run a standard repair on all media groups
  const repairAllMediaGroups = async () => {
    try {
      setIsRepairing(true);
      
      const { data, error } = await supabase.functions.invoke(
        'direct-media-group-repair',
        {
          body: { 
            repair_type: 'standard'
          }
        }
      );
      
      if (error) throw error;
      
      toast({
        title: "Media Groups Repaired",
        description: `Successfully repaired ${data.fixed_count} media groups.`
      });
      
      return data;
    } catch (error) {
      console.error('Error repairing all media groups:', error);
      
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

  return {
    repairMediaGroup,
    repairAllMediaGroups,
    isRepairing
  };
}
