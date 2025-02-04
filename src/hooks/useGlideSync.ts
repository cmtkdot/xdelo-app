import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface GlideSyncMetrics {
  total_messages: number;
  successful_messages: number;
  failed_messages: number;
  sync_batch_id: string;
}

export const useGlideSync = () => {
  const queryClient = useQueryClient();

  // Fetch sync metrics
  const { data: syncMetrics, isLoading: isLoadingMetrics } = useQuery({
    queryKey: ['glide-sync-metrics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('glide_messages_sync_metrics')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      return data as GlideSyncMetrics;
    },
  });

  // Trigger sync for a message
  const { mutate: syncMessage } = useMutation({
    mutationFn: async (messageId: string) => {
      const { data, error } = await supabase.functions.invoke('sync-messages-to-glide', {
        body: { messageId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['glide-sync-metrics'] });
      toast.success('Message synced to Glide successfully');
    },
    onError: (error) => {
      console.error('Glide sync error:', error);
      toast.error('Failed to sync message to Glide');
    },
  });

  // Configure Glide mapping
  const { mutate: configureMapping } = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('configure-glide-mapping', {
        body: {},
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Glide mapping configured successfully');
    },
    onError: (error) => {
      console.error('Glide mapping configuration error:', error);
      toast.error('Failed to configure Glide mapping');
    },
  });

  // Get sync status for a message
  const getSyncStatus = async (messageId: string) => {
    const { data, error } = await supabase
      .from('glide_messages_sync_queue')
      .select('*')
      .eq('message_id', messageId)
      .single();

    if (error) throw error;
    return data;
  };

  return {
    syncMetrics,
    isLoadingMetrics,
    syncMessage,
    configureMapping,
    getSyncStatus,
  };
};