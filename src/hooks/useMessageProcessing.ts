
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from '@/integrations/supabase/client';
import { Message, ProcessingState } from '@/types';
import { useToast } from './useToast';

export const useMessageProcessing = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);

  // Function to update a message's processing state
  const updateMessageState = async (
    messageId: string,
    state: ProcessingState,
    additionalData: Partial<Message> = {}
  ) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .update({
          processing_state: state,
          ...additionalData,
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error: any) {
      console.error(`Failed to update message ${messageId} state to ${state}:`, error);
      return { data: null, error };
    }
  };

  // Retry message analysis
  const retryMessageAnalysis = async (message: Message) => {
    if (!message || !message.id) {
      toast({
        title: "Error",
        description: "Invalid message data",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsProcessing(true);
      
      toast({
        title: "Processing",
        description: "Reprocessing message...",
      });

      // First update message state to pending
      const { error: updateError } = await updateMessageState(message.id, 'pending' as ProcessingState, {
        error_message: null,
        retry_count: (message.retry_count || 0) + 1,
        processing_started_at: new Date().toISOString(),
      });

      if (updateError) throw updateError;

      // Call the analyze function
      const response = await fetch(
        `${supabase.supabaseUrl}/functions/v1/create-analyze-message-caption`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabase.supabaseKey}`
          },
          body: JSON.stringify({
            messageId: message.id,
            caption: message.caption || "",
            mediaGroupId: message.media_group_id,
            correlationId: crypto.randomUUID()
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to analyze message: ${response.statusText}`);
      }

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['messages'] });

      toast({
        title: "Success",
        description: "Message reprocessing started",
      });
    } catch (error: any) {
      console.error('Error retrying analysis:', error);
      
      // Update message with error state
      await updateMessageState(message.id, 'error' as ProcessingState, {
        error_message: error.message,
        processing_completed_at: new Date().toISOString(),
        last_error_at: new Date().toISOString()
      });

      toast({
        title: "Error",
        description: error.message || "Failed to reprocess message",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Update a message's caption and trigger reprocessing
  const updateMessageCaption = async (message: Message, caption: string) => {
    if (!message || !message.id) {
      toast({
        title: "Error",
        description: "Invalid message data",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsProcessing(true);
      
      toast({
        title: "Processing",
        description: "Updating caption...",
      });

      // Update the caption directly in the database
      const { error } = await updateMessageState(message.id, 'pending' as ProcessingState, {
        caption
      });

      if (error) throw error;

      // Trigger reprocessing with the new caption
      await retryMessageAnalysis({...message, caption});

      toast({
        title: "Success",
        description: "Caption updated and reprocessing started",
      });
    } catch (error: any) {
      console.error('Error updating caption:', error);
      
      toast({
        title: "Error",
        description: error.message || "Failed to update caption",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    isProcessing,
    retryMessageAnalysis,
    updateMessageCaption,
    updateMessageState
  };
};
