
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';

// Set this to true to use the Edge Function instead of direct RPC
const USE_EDGE_FUNCTION = true;

export function useMessageProcessingStats() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingStats, setProcessingStats] = useState<any>(null);
  const { toast } = useToast();

  const fetchProcessingStats = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      let data;
      let fetchError;
      
      // Try direct RPC first if not using edge function
      if (!USE_EDGE_FUNCTION) {
        const result = await supabase.rpc('xdelo_get_message_processing_stats');
        data = result.data;
        fetchError = result.error;
      }
      
      // If direct RPC failed or we're using edge function, try the edge function
      if (USE_EDGE_FUNCTION || fetchError) {
        console.log("Using edge function for health stats");
        const response = await fetch('/api/functions/v1/health-stats');
        
        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(`API error: ${response.status} - ${errorData}`);
        }
        
        const apiResult = await response.json();
        
        if (!apiResult.success) {
          throw new Error(apiResult.error || 'API returned error');
        }
        
        data = apiResult.health_metrics;
      } else if (fetchError) {
        throw fetchError;
      }
      
      setProcessingStats(data);
      return data;
    } catch (error: any) {
      console.error('Error getting processing health stats:', error);
      setError(error.message || "Could not retrieve processing health statistics");
      
      toast({
        title: "Failed to Get Health Stats",
        description: error.message || "Could not retrieve processing health statistics",
        variant: "destructive"
      });
      
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    fetchProcessingStats,
    processingStats,
    isLoading,
    error,
    clearError
  };
}
