
import { useCallback, useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import { toast } from 'sonner';

interface StuckMessageResult {
  reset_count?: number;
  messages?: Array<{
    message_id: string;
    previous_state: string;
    reset_reason: string;
  }>;
}

interface MediaGroupRepairResult {
  fixed_groups?: Array<{
    media_group_id: string;
    messages_updated: number;
  }>;
  total_fixed?: number;
}

export function useSystemHealthMonitor() {
  const [isLoading, setIsLoading] = useState(false);

  const repairStuckMessages = useCallback(async () => {
    try {
      setIsLoading(true);
      // Use the SQL function we created
      const { data, error } = await supabase.rpc('xdelo_reset_stalled_messages', {
        p_minutes_threshold: 15,
        p_correlation_id: `manual_repair_${new Date().toISOString()}`
      });
      
      if (error) throw error;
      
      const result = data as StuckMessageResult;
      toast.success(`Reset ${result.reset_count || 0} stuck messages`);
      return result;
    } catch (error) {
      console.error('Failed to repair stuck messages:', error);
      toast.error('Failed to repair stuck messages');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const repairMediaGroups = useCallback(async () => {
    try {
      setIsLoading(true);
      // Directly query the database instead of using RPC
      const { data: brokenGroups } = await supabase.rpc('xdelo_find_broken_media_groups');
      
      // Process broken groups
      let fixedCount = 0;
      if (brokenGroups && brokenGroups.length > 0) {
        // Call media group repair for each broken group
        for (const group of brokenGroups) {
          if (group.source_message_id && group.media_group_id) {
            // Call sync function for each group
            await supabase.functions.invoke('direct-media-group-repair', {
              body: {
                source_message_id: group.source_message_id,
                media_group_id: group.media_group_id,
                correlation_id: `manual_repair_${new Date().toISOString()}`
              }
            });
            fixedCount++;
          }
        }
      }
      
      const result: MediaGroupRepairResult = {
        fixed_groups: brokenGroups?.map(g => ({
          media_group_id: g.media_group_id,
          messages_updated: g.pending_count
        })),
        total_fixed: fixedCount
      };
      
      toast.success(`Fixed ${fixedCount} broken media groups`);
      return result;
    } catch (error) {
      console.error('Failed to repair media groups:', error);
      toast.error('Failed to repair media groups');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    repairStuckMessages,
    repairMediaGroups
  };
}
