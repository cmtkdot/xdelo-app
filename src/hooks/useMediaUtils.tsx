
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/useToast';

export function useMediaUtils() {
  const [isLoading, setLoading] = useState(false);
  const { toast } = useToast();
  
  const syncMediaGroup = async (sourceMessageId: string, mediaGroupId: string, options: { forceSync?: boolean; syncEditHistory?: boolean } = {}) => {
    try {
      setLoading(true);
      
      const correlationId = crypto.randomUUID();
      
      // Get the source message first
      const { data: message } = await supabase
        .from('messages')
        .select('*')
        .eq('id', sourceMessageId)
        .single();
      
      if (!message || !message.analyzed_content) {
        toast({
          title: 'Error',
          description: 'Source message has no analyzed content to sync',
          variant: 'destructive',
        });
        return false;
      }
      
      // Call the database function directly with RPC using the correct parameter signature
      const { data, error } = await supabase.rpc(
        'xdelo_sync_media_group_content',
        {
          p_message_id: sourceMessageId,
          p_analyzed_content: message.analyzed_content,
          p_force_sync: options.forceSync !== false,
          p_sync_edit_history: !!options.syncEditHistory
        }
      );
      
      if (error) {
        console.error('Error syncing media group:', error);
        toast({
          title: 'Sync Failed',
          description: error.message,
          variant: 'destructive',
        });
        return false;
      }
      
      toast({
        title: 'Group Synced',
        description: `Synchronized content to ${data.updated_count || 0} messages`,
      });
      
      return true;
    } catch (err) {
      console.error('Error in syncMediaGroup:', err);
      toast({
        title: 'Sync Error',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };
  
  return {
    syncMediaGroup,
    isLoading
  };
}
