
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';
import { ProcessingState } from '@/types';

export function useMessageQueue() {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  // Process all pending messages
  const processMessageQueue = async (limit = 10) => {
    try {
      setIsProcessing(true);
      
      // First find unprocessed messages with captions
      const { data: messages, error: findError } = await supabase
        .from('messages')
        .select('id')
        .eq('processing_state', 'pending')
        .limit(limit);
      
      if (findError) throw findError;
      
      if (!messages || messages.length === 0) {
        toast({
          title: "No messages",
          description: "No pending messages found to process."
        });
        return { processed: 0 };
      }
      
      // Process each message
      let successCount = 0;
      let errorCount = 0;
      
      for (const message of messages) {
        try {
          await processMessageById(message.id);
          successCount++;
        } catch (err) {
          console.error(`Failed to process message ${message.id}:`, err);
          errorCount++;
        }
      }
      
      toast({
        title: "Message Processing Complete",
        description: `Processed ${successCount} messages successfully${errorCount > 0 ? `, ${errorCount} failed` : ''}.`
      });
      
      return { processed: successCount, errors: errorCount };
    } catch (error) {
      console.error('Error processing messages:', error);
      
      toast({
        title: "Processing Failed",
        description: error.message || "Failed to process messages",
        variant: "destructive"
      });
      
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  // Find unprocessed messages with captions and queue them for processing
  const queueUnprocessedMessages = async (limit = 20) => {
    try {
      setIsProcessing(true);
      
      // Find messages that have captions but no analyzed content and set them to pending
      const { data, error } = await supabase.from('messages')
        .update({ 
          processing_state: 'pending' as ProcessingState,
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
      if (data && data.length > 0) {
        await processMessageQueue(limit);
      }
      
      return { queued: data?.length || 0 };
    } catch (error) {
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

  // Process a single message by ID
  const processMessageById = async (messageId: string) => {
    try {
      setIsProcessing(true);
      
      // First, set the message to pending state
      const { error: updateError } = await supabase.from('messages')
        .update({ 
          processing_state: 'pending' as ProcessingState,
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId);
      
      if (updateError) throw updateError;
      
      // Call the edge function to process this specific message
      const { data, error } = await supabase.functions.invoke(
        'direct-caption-processor',
        {
          body: { 
            messageId,
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
    } catch (error) {
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

  return {
    processMessageQueue,
    queueUnprocessedMessages,
    processMessageById,
    isProcessing
  };
}
