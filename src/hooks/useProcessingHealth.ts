
import { useState, useCallback } from 'react';
import { supabase } from '../integrations/supabase/client';

// Define a type for the processing health stats
interface ProcessingStats {
  state_counts?: {
    initialized?: number;
    pending?: number;
    processing?: number;
    completed?: number;
    error?: number;
    total_messages?: number;
  };
  media_group_stats?: {
    unprocessed_with_caption?: number;
    stuck_in_processing?: number;
    stalled_no_media_group?: number;
    orphaned_media_group_messages?: number;
  };
  timing_stats?: {
    avg_processing_time_seconds?: number;
    oldest_unprocessed_caption_age_hours?: number;
    oldest_stuck_processing_hours?: number;
  };
  timestamp?: string;
}

/**
 * Custom hook for monitoring processing health
 */
export function useProcessingHealth() {
  const [isLoading, setIsLoading] = useState(false);
  const [processingStats, setProcessingStats] = useState<ProcessingStats | null>(null);

  /**
   * Get processing health metrics
   */
  const diagnoseProcessingHealth = useCallback(async (options = { trigger_repair: false }) => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase.functions.invoke(
        'monitor-processing-health',
        {
          body: { trigger_repair: options.trigger_repair }
        }
      );
      
      if (error) throw error;
      
      setProcessingStats(data.health_metrics);
      return data.health_metrics;
    } catch (error) {
      console.error('Failed to get processing health metrics:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    diagnoseProcessingHealth,
    processingStats,
    isLoading
  };
}
