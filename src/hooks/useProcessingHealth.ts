
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProcessingHealthStats {
  totalMessages: number;
  pendingMessages: number;
  processingMessages: number;
  completedMessages: number;
  errorMessages: number;
  stuckMessages: number;
  processingRate: number;
  averageProcessingTime: number;
}

export function useProcessingHealth() {
  const { data: stats, isLoading, error, refetch } = useQuery({
    queryKey: ['processing-health'],
    queryFn: async (): Promise<ProcessingHealthStats> => {
      try {
        const { data, error } = await supabase.functions.invoke('repair-processing-flow', {
          body: { action: 'get_processing_health' }
        });
        
        if (error) throw new Error(error.message);
        
        return data as ProcessingHealthStats;
      } catch (err) {
        console.error('Error fetching processing health stats:', err);
        // Return default values if there's an error
        return {
          totalMessages: 0,
          pendingMessages: 0,
          processingMessages: 0,
          completedMessages: 0,
          errorMessages: 0,
          stuckMessages: 0,
          processingRate: 0,
          averageProcessingTime: 0
        };
      }
    },
    staleTime: 60000, // 1 minute
  });

  return {
    stats: stats || {
      totalMessages: 0,
      pendingMessages: 0,
      processingMessages: 0,
      completedMessages: 0,
      errorMessages: 0,
      stuckMessages: 0, 
      processingRate: 0,
      averageProcessingTime: 0
    },
    isLoading,
    error,
    refetch
  };
}
