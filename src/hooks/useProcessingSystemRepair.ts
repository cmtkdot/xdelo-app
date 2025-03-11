
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';
import { logSyncOperation } from '@/lib/syncUtils';
import type { AnalyzedContent } from '@/types';

export function useProcessingSystemRepair() {
  const [isRepairing, setIsRepairing] = useState(false);
  const { toast } = useToast();

  /**
   * Get statistics about the current processing system state
   */
  const getProcessingStats = async () => {
    try {
      const { data: stuckMessages, error: stuckError } = await supabase
        .from('messages')
        .select('id, telegram_message_id, caption, processing_state, processing_started_at')
        .eq('processing_state', 'processing')
        .gt('processing_started_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('processing_started_at', { ascending: false });
      
      if (stuckError) throw stuckError;
      
      const { data: pendingMessages, error: pendingError } = await supabase
        .from('messages')
        .select('count')
        .eq('processing_state', 'pending');
      
      if (pendingError) throw pendingError;
      
      // Count unprocessed messages with captions
      const { data: unprocessedMessages, error: unprocessedError } = await supabase
        .from('messages')
        .select('count')
        .is('analyzed_content', null)
        .not('caption', 'is', null);
      
      if (unprocessedError) throw unprocessedError;
      
      // We'll try to check if the legacy queue table exists, but handle it gracefully if not
      let queueCount = 0;
      try {
        const { data: queueEntries, error: queueError } = await supabase
          .from('message_processing_queue')
          .select('count');
        
        if (!queueError) {
          queueCount = queueEntries?.[0]?.count || 0;
        }
      } catch (e) {
        // Queue table might not exist anymore, which is fine
        console.log('Queue table may not exist (expected):', e);
      }
      
      return {
        stuck_messages: stuckMessages || [],
        stuck_count: stuckMessages?.length || 0,
        pending_count: pendingMessages?.[0]?.count || 0,
        unprocessed_count: unprocessedMessages?.[0]?.count || 0,
        queue_count: queueCount
      };
    } catch (error) {
      console.error('Error getting processing stats:', error);
      throw error;
    }
  };

  /**
   * Reset stuck messages in the processing state and clean up legacy queue entries
   */
  const repairProcessingSystem = async () => {
    try {
      setIsRepairing(true);
      
      // Step 1: Call the repair system edge function
      const { data, error } = await supabase.functions.invoke(
        'repair-processing-flow',
        { 
          body: { 
            limit: 20,
            repair_enums: true
          } 
        }
      );
      
      if (error) throw error;
      
      // Step 2: Force direct processing on pending messages
      const { data: schedulerData, error: schedulerError } = await supabase.functions.invoke(
        'scheduler-process-queue',
        {
          body: { 
            limit: 20,
            trigger_source: 'manual',
            repair: true
          }
        }
      );
      
      if (schedulerError) throw schedulerError;
      
      // Step 3: Direct database update for any remaining stuck messages
      const { error: updateError } = await supabase.rpc('xdelo_reset_stalled_messages');
      
      if (updateError) {
        // Non-fatal error, log but continue
        console.warn('Warning during stalled message reset:', updateError);
      }
      
      const processedCount = data?.data?.processed || 0;
      const schedulerResults = schedulerData?.result || {};
      
      toast({
        title: "Processing System Repaired",
        description: `Successfully repaired ${processedCount} stuck messages and optimized the processing system.`,
      });
      
      // Log the successful repair operation
      // Cast to any to avoid type issues with the logSyncOperation function
      await logSyncOperation(
        supabase as any,
        'processing_system_repair',
        {
          processed_count: processedCount,
          scheduler_results: schedulerResults,
          timestamp: new Date().toISOString()
        },
        true
      );
      
      return { 
        success: true, 
        processed: processedCount,
        scheduler_results: schedulerResults
      };
      
    } catch (error: any) {
      console.error('Error repairing processing system:', error);
      
      toast({
        title: "Repair Failed",
        description: error.message || "Failed to repair processing system",
        variant: "destructive"
      });
      
      // Log the failed repair attempt
      // Cast to any to avoid type issues with the logSyncOperation function
      await logSyncOperation(
        supabase as any,
        'processing_system_repair',
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
    repairProcessingSystem,
    getProcessingStats,
    isRepairing,
    repairStuckMessages
  };
}
