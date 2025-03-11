
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';
import { useMessageProcessingStats } from './useMessageProcessingStats';

export function useProcessingHealth() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { 
    fetchProcessingStats, 
    processingStats, 
    isLoading: statsLoading,
    error: statsError
  } = useMessageProcessingStats();

  const diagnoseProcessingHealth = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Use the new hook to get stats
      const stats = await fetchProcessingStats();
      
      return stats;
    } catch (error: any) {
      console.error('Error in diagnoseProcessingHealth:', error);
      
      toast({
        title: "Failed to Get Health Stats",
        description: error.message || "Could not retrieve processing health statistics",
        variant: "destructive"
      });
      
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [fetchProcessingStats, toast]);

  return {
    diagnoseProcessingHealth,
    processingStats,
    isLoading: isLoading || statsLoading,
    error: statsError
  };
}
