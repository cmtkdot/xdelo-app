
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ProcessingState } from '@/types';

interface ProcessingStats {
  total: number;
  byState: Record<ProcessingState, number>;
  pendingCount: number;
  processingCount: number;
  errorCount: number;
  completedCount: number;
  initializedCount: number;
  partialSuccessCount: number;
  stalledCount: number;
}

interface ProcessingSystemStatus {
  isLoading: boolean;
  stats: ProcessingStats;
  lastUpdated: Date | null;
  error: string | null;
}

const defaultStats: ProcessingStats = {
  total: 0,
  byState: {
    'initialized': 0,
    'pending': 0,
    'processing': 0,
    'completed': 0,
    'error': 0,
    'partial_success': 0
  },
  pendingCount: 0,
  processingCount: 0,
  errorCount: 0,
  completedCount: 0,
  initializedCount: 0,
  partialSuccessCount: 0,
  stalledCount: 0
};

export function useProcessingSystem(): ProcessingSystemStatus {
  const [status, setStatus] = useState<ProcessingSystemStatus>({
    isLoading: true,
    stats: defaultStats,
    lastUpdated: null,
    error: null
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setStatus(prev => ({ ...prev, isLoading: true }));
        
        // Get counts by state
        const { data: stateCounts, error: stateError } = await supabase
          .from('messages')
          .select('processing_state, count')
          .group('processing_state');
          
        if (stateError) throw stateError;
        
        // Get stalled message count (messages stuck in processing for over 5 minutes)
        const { data: stalledData, error: stalledError } = await supabase
          .from('messages')
          .select('count')
          .eq('processing_state', 'processing')
          .lt('processing_started_at', new Date(Date.now() - 5 * 60 * 1000).toISOString());
          
        if (stalledError) throw stalledError;
        
        // Build stats object
        const stats: ProcessingStats = {
          ...defaultStats,
          stalledCount: stalledData[0]?.count || 0
        };
        
        let total = 0;
        
        // Process state counts
        stateCounts.forEach(item => {
          const state = item.processing_state as ProcessingState;
          const count = parseInt(item.count as string);
          
          stats.byState[state] = count;
          total += count;
          
          // Update individual counters
          if (state === 'pending') stats.pendingCount = count;
          if (state === 'processing') stats.processingCount = count;
          if (state === 'error') stats.errorCount = count;
          if (state === 'completed') stats.completedCount = count;
          if (state === 'initialized') stats.initializedCount = count;
          if (state === 'partial_success') stats.partialSuccessCount = count;
        });
        
        stats.total = total;
        
        setStatus({
          isLoading: false,
          stats,
          lastUpdated: new Date(),
          error: null
        });
      } catch (error) {
        console.error('Error fetching processing system stats:', error);
        setStatus(prev => ({
          ...prev,
          isLoading: false,
          error: error.message || 'Failed to fetch processing system stats'
        }));
      }
    };
    
    fetchStats();
    
    // Set up refresh interval
    const intervalId = setInterval(fetchStats, 30000); // Update every 30 seconds
    
    return () => clearInterval(intervalId);
  }, []);
  
  return status;
}
