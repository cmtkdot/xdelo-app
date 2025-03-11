
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useProcessingStats() {
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

  return {
    getProcessingStats
  };
}
