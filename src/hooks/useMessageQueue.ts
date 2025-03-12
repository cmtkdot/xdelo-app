
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';
import { ProcessingState } from '@/types';

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
    processMessageById,
    isProcessing
  };
}
