
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
            trigger_source: 'manual',
            force_reprocess: true
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

  // Function to process all messages that need attention
  const xdelo_processStuckMessages = async (limit: number = 50) => {
    try {
      setIsProcessing(true);
      
      // Call the repair processing flow edge function
      const { data, error } = await supabase.functions.invoke(
        'repair-processing-flow',
        {
          body: { 
            limit,
            repair_enums: true,
            reset_all: false,
            force_reset_stalled: true
          }
        }
      );
      
      if (error) throw error;
      
      const results = data.results || {};
      
      toast({
        title: "Processing System Repair",
        description: `Fixed ${results.stuck_reset || 0} stuck messages and ${results.initialized_processed || 0} pending messages.`
      });
      
      return data;
    } catch (error) {
      console.error('Error in processing system repair:', error);
      
      toast({
        title: "Repair Failed",
        description: error.message || "Failed to repair processing system",
        variant: "destructive"
      });
      
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  // Function to reset all stalled messages
  const xdelo_resetStalledMessages = async () => {
    try {
      setIsProcessing(true);
      
      // Call the RPC function to reset stalled messages
      const { data, error } = await supabase.rpc('xdelo_reset_stalled_messages');
      
      if (error) throw error;
      
      const resetCount = data?.length || 0;
      
      toast({
        title: "Reset Completed",
        description: `Reset ${resetCount} stalled messages to pending state.`
      });
      
      return resetCount;
    } catch (error) {
      console.error('Error resetting stalled messages:', error);
      
      toast({
        title: "Reset Failed",
        description: error.message || "Failed to reset stalled messages",
        variant: "destructive"
      });
      
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    processMessageById,
    xdelo_processStuckMessages,
    xdelo_resetStalledMessages,
    isProcessing
  };
}
