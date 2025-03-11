
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';

interface ProcessingStats {
  state_counts: {
    initialized: number;
    pending: number;
    processing: number;
    completed: number;
    error: number;
    total_messages: number;
  };
  media_group_stats: {
    unprocessed_with_caption: number;
    stuck_in_processing: number;
    stalled_no_media_group: number;
    orphaned_media_group_messages: number;
  };
  timing_stats: {
    avg_processing_time_seconds: number | null;
    oldest_unprocessed_caption_age_hours: number | null;
    oldest_stuck_processing_hours: number | null;
  };
  timestamp: string;
  mixed_media_groups?: MediaGroupStatus[];
}

interface MediaGroupStatus {
  media_group_id: string;
  total_messages: number;
  processed_messages: number;
  unprocessed_messages: number;
  oldest_message_id: string;
  oldest_message_created_at: string;
}

export function useProcessingHealth() {
  const [isLoading, setIsLoading] = useState(false);
  const [processingStats, setProcessingStats] = useState<ProcessingStats | null>(null);
  const { toast } = useToast();

  const diagnoseProcessingHealth = async () => {
    try {
      setIsLoading(true);
      
      // Get processing stats
      const { data: statsCounts, error: stateError } = await supabase.rpc(
        'xdelo_get_message_processing_stats'
      );
      
      if (stateError) throw stateError;
      
      // Get details about media groups with mixed processing states
      const { data: mixedMediaGroups, error: mixedError } = await supabase.rpc(
        'xdelo_get_incomplete_media_groups',
        { limit_param: 5 }
      );
      
      if (mixedError) throw mixedError;

      // Combine everything into a health report
      const healthReport: ProcessingStats = {
        ...(statsCounts as ProcessingStats),
        mixed_media_groups: mixedMediaGroups as MediaGroupStatus[] || []
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

  return {
    diagnoseProcessingHealth,
    processingStats,
    isLoading
  };
}
