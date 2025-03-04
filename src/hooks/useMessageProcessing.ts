
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
      
      // First, mark the message for reprocessing in the database
      const { error: updateError } = await supabase
        .from('messages')
        .update({
          processing_state: 'pending',
          analyzed_content: null, // Clear existing analysis to force reanalysis
          updated_at: new Date().toISOString(),
          correlation_id: correlationId
        })
        .eq('id', message.id);
        
      if (updateError) {
        throw updateError;
      }
      
      // Use direct function invocation for immediate processing
      const { data: parseData, error: parseError } = await supabase.functions.invoke(
        'parse-caption-with-ai',
        {
          body: { 
            messageId: message.id,
            caption: message.caption,
            media_group_id: message.media_group_id,
            correlationId: correlationId
          }
        }
      );
      
      if (parseError) {
        console.error('Direct parsing failed, falling back to queue:', parseError);
        
        // Fall back to queue if direct invoke fails
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
        
        // Process the queue immediately
        const { data: processingData, error: processingError } = await supabase.functions.invoke(
          'process-message-queue',
          {
            body: { limit: 1 }
          }
        );
        
        if (processingError) {
          throw processingError;
        }
        
        console.log('Queue processing result:', processingData);
      } else {
        console.log('Direct parsing succeeded:', parseData);
        
        // If this is a media group, trigger sync as well
        if (message.media_group_id) {
          try {
            const { data: syncData, error: syncError } = await supabase.rpc(
              'xdelo_sync_media_group_content',
              {
                p_source_message_id: message.id,
                p_media_group_id: message.media_group_id,
                p_correlation_id: correlationId
              }
            );
            
            if (syncError) {
              console.warn('Media group sync error:', syncError);
            } else {
              console.log('Media group sync result:', syncData);
            }
          } catch (syncErr) {
            console.error('Error in media group sync:', syncErr);
          }
        }
      }
      
      toast({
        title: "Processing Initiated",
        description: "The message has been processed or queued for analysis."
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
