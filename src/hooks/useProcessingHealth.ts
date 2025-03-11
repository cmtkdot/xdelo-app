
import { useState, useCallback } from 'react';
import { supabase } from '../integrations/supabase/client';

/**
 * Custom hook for monitoring processing health
 */
export function useProcessingHealth() {
  const [isLoading, setIsLoading] = useState(false);
  const [processingStats, setProcessingStats] = useState(null);

  /**
   * Get processing health metrics
   */
  const diagnoseProcessingHealth = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase.functions.invoke(
        'monitor-processing-health',
        {
          body: { trigger_repair: false }
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
