
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';

export function useMessageQueue() {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  // Process all pending messages
  const processMessageQueue = async (limit = 10, repair = false) => {
    try {
      setIsProcessing(true);
      
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
    } finally {
      setIsProcessing(false);
    }
  };

  // Find unprocessed messages with captions and queue them for processing
  const queueUnprocessedMessages = async (limit = 20) => {
    try {
      setIsProcessing(true);
      
      // First, find messages that have captions but no analyzed content and set them to pending
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
          processing_state: 'pending',
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

  return {
    processMessageQueue,
    queueUnprocessedMessages,
    processMessageById,
    isProcessing
  };
}
