
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';

export function useMessageQueue() {
  const { toast } = useToast();

  // Process all pending messages
  const processMessageQueue = async (limit = 10, repair = false) => {
    try {
      // Call the scheduler function to process pending messages
      const { data, error } = await supabase.functions.invoke(
        'scheduler-process-queue',
        {
          body: { 
            limit,
            trigger_source: 'manual',
            repair
          }
        }
      );
      
      if (error) throw error;
      
      if (repair) {
        toast({
          title: "System Repair Complete",
          description: `Diagnostics and repairs completed successfully.`
        });
      } else {
        toast({
          title: "Message Processing Complete",
          description: `Processed ${data?.result?.processed_count || 0} pending messages.`
        });
      }
      
      return data;
    } catch (error: any) {
      console.error('Error processing messages:', error);
      
      toast({
        title: "Processing Failed",
        description: error.message || "Failed to process messages",
        variant: "destructive"
      });
      
      throw error;
    }
  };

  // Find unprocessed messages with captions and queue them for processing
  const queueUnprocessedMessages = async (limit = 10) => {
    try {
      const { data, error } = await supabase.from('messages')
        .update({ 
          processing_state: 'pending',
          updated_at: new Date().toISOString() 
        })
        .is('analyzed_content', null)
        .not('caption', 'is', null)
        .not('caption', 'eq', '')
        .limit(limit)
        .select('id');
      
      if (error) throw error;
      
      toast({
        title: "Messages Queued",
        description: `Queued ${data?.length || 0} unprocessed messages.`
      });
      
      // Immediately run the processor after queueing
      await processMessageQueue(limit);
      
      return { queued: data?.length || 0 };
    } catch (error: any) {
      console.error('Error queueing unprocessed messages:', error);
      
      toast({
        title: "Queueing Failed",
        description: error.message || "Failed to queue unprocessed messages",
        variant: "destructive"
      });
      
      throw error;
    }
  };

  return {
    processMessageQueue,
    queueUnprocessedMessages
  };
}
