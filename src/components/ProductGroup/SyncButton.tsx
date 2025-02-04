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

      // Queue new sync directly without checking status
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