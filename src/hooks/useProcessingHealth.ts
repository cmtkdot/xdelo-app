
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';

/**
 * Hook for monitoring the health of the message processing system
 */
export function useProcessingHealth() {
  const [isLoading, setIsLoading] = useState(false);
  const [processingStats, setProcessingStats] = useState<any>(null);
  const { toast } = useToast();

  /**
   * Diagnose the current health of the message processing system
   */
  const diagnoseProcessingHealth = async () => {
    try {
      setIsLoading(true);
      
      // First get counts of messages in each state
      const { data: stateCounts, error: stateError } = await supabase.rpc(
        'xdelo_get_message_processing_stats'
      );
      
      if (stateError) throw stateError;
      
      // Then get details about stuck messages
      const { data: stuckMessages, error: stuckError } = await supabase
        .from('messages')
        .select('id, caption, processing_state, processing_started_at, error_message, telegram_message_id')
        .in('processing_state', ['processing', 'error'])
        .order('processing_started_at', { ascending: false })
        .limit(10);
      
      if (stuckError) throw stuckError;
      
      // Get details about oldest unprocessed messages with captions
      const { data: unprocessedMessages, error: unprocessedError } = await supabase
        .from('messages')
        .select('id, caption, processing_state, created_at, telegram_message_id')
        .is('analyzed_content', null)
        .not('caption', 'is', null)
        .order('created_at', { ascending: true })
        .limit(10);
      
      if (unprocessedError) throw unprocessedError;
      
      // Get details about media groups with mixed processing states
      const { data: mixedMediaGroups, error: mixedError } = await supabase.rpc(
        'xdelo_get_incomplete_media_groups', 
        { limit_param: 5 }
      );
      
      if (mixedError) throw mixedError;
      
      // Combine all results into a comprehensive health report
      const healthReport = {
        timestamp: new Date().toISOString(),
        state_counts: stateCounts || {},
        stuck_messages: stuckMessages || [],
        unprocessed_messages: unprocessedMessages || [],
        mixed_media_groups: mixedMediaGroups || [],
        metrics: {
          stuck_percentage: calculatePercentage(
            (stuckMessages || []).length, 
            stateError ? 0 : stateCounts?.total_messages || 0
          ),
          unprocessed_percentage: calculatePercentage(
            (unprocessedMessages || []).length, 
            stateError ? 0 : stateCounts?.total_messages || 0
          ),
        }
      };
      
      setProcessingStats(healthReport);
      return healthReport;
    } catch (error: any) {
      console.error('Error diagnosing processing health:', error);
      
      toast({
        title: "Diagnostic Failed",
        description: error.message || "Failed to diagnose processing health",
        variant: "destructive"
      });
      
      throw error;
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * Calculate percentage with fallback
   */
  const calculatePercentage = (part: number, total: number): number => {
    if (total === 0) return 0;
    return Math.round((part / total) * 100 * 10) / 10; // One decimal place
  };

  return {
    diagnoseProcessingHealth,
    processingStats,
    isLoading
  };
}
