
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';
import { logSyncOperation } from '@/lib/syncUtils';

export function useStuckMessageRepair() {
  const [isRepairing, setIsRepairing] = useState(false);
  const { toast } = useToast();
  
  /**
   * Specifically targets and resets stuck messages, then processes unprocessed messages with captions
   */
  const repairStuckMessages = async () => {
    try {
      setIsRepairing(true);
      
      // First, find and reset all stuck messages
      const { data: resetData, error: resetError } = await supabase
        .from('messages')
        .update({
          processing_state: 'pending',
          processing_started_at: null,
          error_message: 'Reset from stuck processing state',
          updated_at: new Date().toISOString()
        })
        .eq('processing_state', 'processing')
        .is('analyzed_content', null)
        .not('caption', 'is', null)
        .select('id, caption');
      
      if (resetError) throw resetError;
      
      // Then find "initialized" messages with captions and set them to pending
      const { data: initializedData, error: initializedError } = await supabase
        .from('messages')
        .update({
          processing_state: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('processing_state', 'initialized')
        .not('caption', 'is', null)
        .select('id, caption');
      
      if (initializedError) throw initializedError;
      
      // Direct processing of specific messages with captions
      const messagesToProcess = [...(resetData || []), ...(initializedData || [])];
      let processedCount = 0;
      
      if (messagesToProcess.length > 0) {
        for (const message of messagesToProcess) {
          try {
            // Only process messages with actual captions
            if (message.caption) {
              // Use direct-caption-processor for immediate processing
              await supabase.functions.invoke('direct-caption-processor', {
                body: { 
                  messageId: message.id,
                  trigger_source: 'manual_repair'
                }
              });
              processedCount++;
            }
          } catch (processError) {
            console.error(`Error processing message ${message.id}:`, processError);
          }
        }
      }
      
      toast({
        title: "Stuck Messages Repaired",
        description: `Reset ${resetData?.length || 0} stuck messages and ${initializedData?.length || 0} initialized messages. Processed ${processedCount} messages.`,
      });
      
      // Log the repair operation
      // Cast to any to avoid type issues with the logSyncOperation function
      await logSyncOperation(
        supabase as any,
        'stuck_messages_repair',
        {
          reset_count: resetData?.length || 0,
          initialized_count: initializedData?.length || 0,
          processed_count: processedCount,
          timestamp: new Date().toISOString()
        },
        true
      );
      
      return { 
        success: true,
        reset: resetData?.length || 0,
        initialized: initializedData?.length || 0,
        processed: processedCount
      };
      
    } catch (error: any) {
      console.error('Error repairing stuck messages:', error);
      
      toast({
        title: "Repair Failed",
        description: error.message || "Failed to repair stuck messages",
        variant: "destructive"
      });
      
      // Log the failed repair attempt
      // Cast to any to avoid type issues with the logSyncOperation function
      await logSyncOperation(
        supabase as any,
        'stuck_messages_repair',
        {
          error: error.message,
          timestamp: new Date().toISOString()
        },
        false,
        error.message
      );
      
      throw error;
    } finally {
      setIsRepairing(false);
    }
  };

  return {
    repairStuckMessages,
    isRepairing
  };
}
