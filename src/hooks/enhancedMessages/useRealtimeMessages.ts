
import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to handle realtime updates for messages
 */
export function useRealtimeMessages(enabled: boolean = true) {
  const queryClient = useQueryClient();
  const [realtimeEnabled, setRealtimeEnabled] = useState(enabled);
  
  // Set up Supabase realtime subscription
  useEffect(() => {
    if (!realtimeEnabled) return;
    
    const channel = supabase
      .channel('messages-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        () => {
          // Invalidate and refetch messages
          queryClient.invalidateQueries({ queryKey: ['enhanced-messages'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, realtimeEnabled]);

  // Provide a toggle for realtime updates
  const toggleRealtime = () => {
    setRealtimeEnabled(prev => !prev);
  };

  return {
    realtimeEnabled,
    toggleRealtime
  };
}
