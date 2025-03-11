
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';

export function useProcessingHealth() {
  const [isLoading, setIsLoading] = useState(false);
  const [processingStats, setProcessingStats] = useState<any>(null);
  const { toast } = useToast();

  const diagnoseProcessingHealth = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Call the function to get processing stats
      const { data, error } = await supabase.rpc('xdelo_get_message_processing_stats');
      
      if (error) throw error;
      
      setProcessingStats(data);
      return data;
    } catch (error: any) {
      console.error('Error getting processing health stats:', error);
      
      toast({
        title: "Failed to Get Health Stats",
        description: error.message || "Could not retrieve processing health statistics",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  return {
    diagnoseProcessingHealth,
    processingStats,
    isLoading
  };
}
