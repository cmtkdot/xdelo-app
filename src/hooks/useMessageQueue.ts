
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';

export function useMessageQueue() {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  // Process a single message by ID
  const processMessageById = async (messageId: string) => {
    try {
      setIsProcessing(true);
      
      // First, set the message to pending state
      const { error: updateError } = await supabase.from('messages')
        .update({ 
          processing_state: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId);
      
      if (updateError) throw updateError;
      
      // Call the edge function to process this specific message
      const { data, error } = await supabase.functions.invoke(
        'parse-caption-with-ai',
        {
          body: { 
            messageId,
            isForceUpdate: true,
            trigger_source: 'manual'
          }
        }
      );
      
      if (error) throw error;
      
      toast({
        title: "Message Processed",
        description: `Successfully processed message ${messageId.substring(0, 8)}.`
      });
      
      return data;
    } catch (error: any) {
      console.error('Error processing message:', error);
      
      toast({
        title: "Processing Failed",
        description: error.message || "Failed to process message",
        variant: "destructive"
      });
      
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  // Process a batch of messages from the queue
  const processMessageQueue = async (limit = 10, force = false) => {
    try {
      setIsProcessing(true);
      
      const { data, error } = await supabase.functions.invoke(
        'parse-caption-with-ai',
        {
          body: { 
            operation: 'process_queue',
            limit,
            force,
            trigger_source: 'manual'
          }
        }
      );
      
      if (error) throw error;
      
      toast({
        title: "Queue Processed",
        description: `Successfully processed ${data?.processed || 0} messages.`
      });
      
      return data;
    } catch (error: any) {
      console.error('Error processing message queue:', error);
      
      toast({
        title: "Queue Processing Failed",
        description: error.message || "Failed to process message queue",
        variant: "destructive"
      });
      
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  // Queue unprocessed messages for processing
  const queueUnprocessedMessages = async (limit = 20) => {
    try {
      setIsProcessing(true);
      
      const { data, error } = await supabase.functions.invoke(
        'parse-caption-with-ai',
        {
          body: { 
            operation: 'queue_unprocessed',
            limit,
            trigger_source: 'manual'
          }
        }
      );
      
      if (error) throw error;
      
      toast({
        title: "Messages Queued",
        description: `Added ${data?.queued || 0} messages to processing queue.`
      });
      
      return data;
    } catch (error: any) {
      console.error('Error queueing unprocessed messages:', error);
      
      toast({
        title: "Queueing Failed",
        description: error.message || "Failed to queue unprocessed messages",
        variant: "destructive"
      });
      
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    processMessageById,
    processMessageQueue,
    queueUnprocessedMessages,
    isProcessing
  };
}
