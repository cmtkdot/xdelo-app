import React from 'react';
import { Button } from '@/components/ui/button';
import { useGlideSync } from '@/hooks/useGlideSync';
import { Loader2, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface SyncButtonProps {
  messageId: string;
}

export const SyncButton: React.FC<SyncButtonProps> = ({ messageId }) => {
  const { syncMessage } = useGlideSync();

  const { data: syncStatus, isLoading } = useQuery({
    queryKey: ['sync-status', messageId],
    queryFn: async () => {
      const { data } = await supabase
        .from('glide_messages_sync_queue')
        .select('status, last_error')
        .eq('message_id', messageId)
        .single();
      return data;
    },
  });

  if (isLoading) {
    return (
      <Button variant="ghost" size="sm" disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => syncMessage(messageId)}
      className={
        syncStatus?.status === 'error' ? 'text-red-500' : 'text-green-500'
      }
    >
      <RefreshCw className="h-4 w-4" />
    </Button>
  );
};