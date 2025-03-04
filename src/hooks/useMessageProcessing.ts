
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
      
      // Validate required fields
      if (!message.id) {
        throw new Error('Message ID is required for analysis');
      }
      
      if (!message.caption) {
        throw new Error('Message caption is required for analysis');
      }
      
      // Generate a correlation ID as a string
      const correlationId = crypto.randomUUID();
      
      // Log analysis start
      console.log(`Starting analysis for message ${message.id} with correlation ID ${correlationId}`);
      
      // First, try the create-analyze-message-caption function for direct triggering
      const { data: prepResult, error: prepError } = await supabase.functions.invoke(
        'create-analyze-message-caption',
        {
          body: { 
            messageId: message.id, 
            caption: message.caption,
            mediaGroupId: message.media_group_id,
            correlationId
          }
        }
      );
      
      if (prepError) {
        console.warn('Direct trigger failed, falling back to parse-caption-with-ai:', prepError);
        
        // Fall back to calling parse-caption-with-ai directly
        const { data: analysisData, error: analysisError } = await supabase.functions.invoke(
          'parse-caption-with-ai',
          {
            body: { 
              messageId: message.id, 
              caption: message.caption,
              media_group_id: message.media_group_id,
              correlationId, 
              isEdit: false
            }
          }
        );
        
        if (analysisError) {
          throw new Error(analysisError.message || 'Analysis failed');
        }
        
        console.log('Analysis result from fallback:', analysisData);
        toast({
          title: "Analysis Complete",
          description: "The message has been analyzed successfully using fallback method."
        });
        
        return analysisData;
      }
      
      console.log('Analysis preparation result:', prepResult);
      
      // Success message
      toast({
        title: "Analysis Complete",
        description: "The message has been analyzed successfully."
      });
      
      return prepResult?.data;
      
    } catch (error: any) {
      console.error('Error analyzing message:', error);
      
      // Set detailed error message
      const errorMessage = error.message || 'Failed to analyze message';
      setErrors(prev => ({ 
        ...prev, 
        [message.id]: errorMessage
      }));
      
      toast({
        title: "Analysis Failed",
        description: errorMessage,
        variant: "destructive"
      });
      
      throw error;
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
          body: { 
            limit,
            trigger_source: 'manual'
          }
        }
      );
      
      if (error) throw error;
      
      toast({
        title: "Message Processing Complete",
        description: `Processed ${data?.result?.processed_count || 0} pending messages.`
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
