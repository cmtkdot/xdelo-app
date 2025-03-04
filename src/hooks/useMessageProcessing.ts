
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';

export function useMessageProcessing() {
  const [isProcessing, setIsProcessing] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  // Manually trigger reanalysis for a specific message
  const handleReanalyze = async (message: any) => {
    if (isProcessing[message.id]) return;
    
    try {
      setIsProcessing(prev => ({ ...prev, [message.id]: true }));
      setErrors(prev => ({ ...prev, [message.id]: '' }));
      
      console.log('Requesting reanalysis for message:', message.id);
      
      // Generate a correlation ID as string
      const correlationId = crypto.randomUUID().toString();
      
      // Use raw SQL call since Supabase's rpc doesn't accept function names from a variable
      const { data, error: queueError } = await supabase.rpc(
        'xdelo_queue_message_for_processing',
        {
          p_message_id: message.id,
          p_correlation_id: correlationId
        }
      );

      if (queueError) {
        throw queueError;
      }

      console.log('Message queued for processing:', data);
      
      // Call the edge function to process the queue
      const { data: processingData, error: processingError } = await supabase.functions.invoke(
        'process-message-queue',
        {
          body: { limit: 1 }
        }
      );
      
      if (processingError) {
        throw processingError;
      }
      
      console.log('Processing result:', processingData);
      
      toast({
        title: "Processing Initiated",
        description: "The message has been queued for analysis."
      });
      
    } catch (error: any) {
      console.error('Error reanalyzing message:', error);
      setErrors(prev => ({ 
        ...prev, 
        [message.id]: error.message || 'Failed to process message' 
      }));
      
      toast({
        title: "Processing Failed",
        description: error.message || "Failed to process message",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(prev => ({ ...prev, [message.id]: false }));
    }
  };

  // Process all pending messages in the queue
  const processMessageQueue = async (limit = 10) => {
    try {
      const { data, error } = await supabase.functions.invoke(
        'process-message-queue',
        {
          body: { limit }
        }
      );
      
      if (error) throw error;
      
      toast({
        title: "Queue Processing Complete",
        description: `Processed ${data?.processed || 0} messages from the queue.`
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
    }
  };

  // Queue any unprocessed messages with captions
  const queueUnprocessedMessages = async (limit = 10) => {
    try {
      const { data, error } = await supabase.functions.invoke(
        'process-unanalyzed-messages',
        {
          body: { limit }
        }
      );
      
      if (error) throw error;
      
      toast({
        title: "Messages Queued",
        description: `Queued ${data?.queued || 0} unprocessed messages.`
      });
      
      return data;
    } catch (error: any) {
      console.error('Error queuing unprocessed messages:', error);
      
      toast({
        title: "Queueing Failed",
        description: error.message || "Failed to queue unprocessed messages",
        variant: "destructive"
      });
      
      throw error;
    }
  };

  return {
    handleReanalyze,
    processMessageQueue,
    queueUnprocessedMessages,
    isProcessing,
    errors
  };
}
