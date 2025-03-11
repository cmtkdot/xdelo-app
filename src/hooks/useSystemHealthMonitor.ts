
import { useCallback, useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import { toast } from 'sonner';

export function useSystemHealthMonitor() {
  const [isLoading, setIsLoading] = useState(false);

  const repairStuckMessages = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.rpc('xdelo_reset_stalled_messages', {
        p_minutes_threshold: 15,
        p_correlation_id: `manual_repair_${new Date().toISOString()}`
      });
      
      if (error) throw error;
      
      toast.success(`Reset ${data.reset_count} stuck messages`);
      return data;
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
      const { data, error } = await supabase.rpc('xdelo_find_broken_media_groups', {
        repair_mode: true,
        correlation_id: `manual_repair_${new Date().toISOString()}`
      });
      
      if (error) throw error;
      
      const fixedCount = data?.fixed_groups?.length || 0;
      toast.success(`Fixed ${fixedCount} broken media groups`);
      return data;
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
