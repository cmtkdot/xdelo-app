
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
      
      // Generate a correlation ID as a string (not a UUID object)
      const correlationId = crypto.randomUUID();
      
      // Call the parse-caption-with-ai function directly
      const { data, error } = await supabase.functions.invoke(
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
      
      if (error) {
        throw error;
      }
      
      console.log('Caption analysis result:', data);
      
      toast({
        title: "Analysis Complete",
        description: "The message caption has been analyzed successfully."
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

  // Process pending messages
  const processPendingMessages = async (limit = 10) => {
    try {
      const { data, error } = await supabase.rpc(
        'xdelo_schedule_caption_processing'
      );
      
      if (error) throw error;
      
      toast({
        title: "Processing Complete",
        description: `Processed ${data?.processed_count || 0} pending messages.`
      });
      
      return data;
    } catch (error: any) {
      console.error('Error processing pending messages:', error);
      
      toast({
        title: "Processing Failed",
        description: error.message || "Failed to process pending messages",
        variant: "destructive"
      });
      
      throw error;
    }
  };

  return {
    handleReanalyze,
    processPendingMessages,
    isProcessing,
    errors
  };
}
