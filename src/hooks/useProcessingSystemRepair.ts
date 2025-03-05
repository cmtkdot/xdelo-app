
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';

export function useProcessingSystemRepair() {
  const [isRepairing, setIsRepairing] = useState(false);
  const { toast } = useToast();

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
            limit: 20 
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
      
      throw error;
    } finally {
      setIsRepairing(false);
    }
  };

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
      
      const { data: queueEntries, error: queueError } = await supabase
        .from('message_processing_queue')
        .select('count');
      
      // This may fail if the queue table is already deleted, which is fine
      const queueCount = queueError ? 0 : queueEntries?.[0]?.count || 0;
      
      return {
        stuck_messages: stuckMessages || [],
        stuck_count: stuckMessages?.length || 0,
        pending_count: pendingMessages?.[0]?.count || 0,
        queue_count: queueCount
      };
      
    } catch (error: any) {
      console.error('Error getting processing stats:', error);
      
      toast({
        title: "Stats Retrieval Failed",
        description: error.message || "Failed to get processing statistics",
        variant: "destructive"
      });
      
      throw error;
    }
  };

  return {
    repairProcessingSystem,
    getProcessingStats,
    isRepairing
  };
}
