import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface SyncButtonProps {
  messageId: string;
}

export const SyncButton = ({ messageId }: SyncButtonProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSync = async () => {
    try {
      setIsLoading(true);

      // Get current sync status
      const { data: syncStatus, error: syncError } = await supabase
        .from('glide_messages_sync_queue')
        .select('status,last_error')
        .eq('message_id', messageId)
        .maybeSingle();

      if (syncError) throw syncError;

      // Get latest metrics
      const { data: metrics, error: metricsError } = await supabase
        .from('glide_messages_sync_metrics')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (metricsError) throw metricsError;

      // Queue new sync
      const { error: queueError } = await supabase
        .from('glide_messages_sync_queue')
        .insert({
          message_id: messageId,
          status: 'pending',
          retry_count: 0
        });

      if (queueError) throw queueError;

      toast({
        title: "Sync queued",
        description: "Message will be synced to Glide shortly."
      });

    } catch (error) {
      console.error('Sync error:', error);
      toast({
        title: "Sync failed",
        description: "Failed to queue sync operation.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button 
      variant="outline" 
      size="sm"
      onClick={handleSync}
      disabled={isLoading}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Syncing...
        </>
      ) : (
        'Sync to Glide'
      )}
    </Button>
  );
};