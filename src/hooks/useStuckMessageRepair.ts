
import { supabase } from '@/integrations/supabase/client';
import { useProcessingRepair } from './useProcessingRepair';

export function useStuckMessageRepair() {
  const { runRepairOperation, isRepairing } = useProcessingRepair();
  
  /**
   * Specifically targets and resets stuck messages, then processes unprocessed messages with captions
   */
  const repairStuckMessages = async () => {
    return runRepairOperation(
      'stuck_messages_repair',
      async () => {
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
        
        return { 
          reset: resetData?.length || 0,
          initialized: initializedData?.length || 0,
          processed: processedCount
        };
      },
      "Stuck Messages Repaired"
    );
  };

  return {
    repairStuckMessages,
    isRepairing
  };
}
