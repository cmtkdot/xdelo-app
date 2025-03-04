
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';

export function useMessageProcessing() {
  const [isProcessing, setIsProcessing] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  // Directly trigger analysis for a specific message
  const handleReanalyze = async (message: any) => {
    if (isProcessing[message.id]) return;
    
    try {
      setIsProcessing(prev => ({ ...prev, [message.id]: true }));
      setErrors(prev => ({ ...prev, [message.id]: '' }));
      
      console.log('Requesting direct analysis for message:', message.id);
      
      // Generate a correlation ID as a string
      const correlationId = crypto.randomUUID();
      
      // Call the parse-caption-with-ai function directly
      const { data: analysisData, error: analysisError } = await supabase.functions.invoke(
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
      
      if (analysisError) {
        throw analysisError;
      }
      
      console.log('Analysis result:', analysisData);
      
      toast({
        title: "Analysis Complete",
        description: "The message has been analyzed successfully."
      });
      
    } catch (error: any) {
      console.error('Error analyzing message:', error);
      setErrors(prev => ({ 
        ...prev, 
        [message.id]: error.message || 'Failed to analyze message' 
      }));
      
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to analyze message",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(prev => ({ ...prev, [message.id]: false }));
    }
  };

  // Process all pending messages
  const processMessageQueue = async (limit = 10) => {
    try {
      // Call the scheduler function to process pending messages
      const { data, error } = await supabase.functions.invoke(
        'scheduler-process-queue',
        {
          body: { limit }
        }
      );
      
      if (error) throw error;
      
      toast({
        title: "Message Processing Complete",
        description: `Processed ${data?.processed || 0} pending messages.`
      });
      
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

  // Find unprocessed messages with captions
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
    handleReanalyze,
    processMessageQueue,
    queueUnprocessedMessages,
    isProcessing,
    errors
  };
}
