
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseRealtimeUpdatesOptions {
  tables: string[];
  onUpdate: () => void;
}

export function useRealtimeUpdates({ tables, onUpdate }: UseRealtimeUpdatesOptions) {
  useEffect(() => {
    const channels = tables.map(table => {
      return supabase
        .channel(`${table}-changes`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table
          },
          (payload) => {
            console.log(`Real-time update received for ${table}:`, payload);
            onUpdate();
          }
        )
        .subscribe();
    });

    return () => {
      channels.forEach(channel => {
        supabase.removeChannel(channel);
      });
    };
  }, [tables, onUpdate]);
}
