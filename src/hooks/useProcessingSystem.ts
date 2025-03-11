
import { useState } from 'react';
import { useToast } from './useToast';
import { supabase } from '@/integrations/supabase/client';

export interface ProcessingSystemStatus {
  queue_health: boolean;
  queued_count: number;
  active_workers: number;
  last_worker_activity: string | null;
  stalled_messages: number;
  pending_messages: number;
  processing_messages: number;
  error_messages: number;
  oldest_pending_message_age_hours: number | null;
  recent_errors: Array<{
    component: string;
    message: string;
    timestamp: string;
  }>;
}

export function useProcessingSystem() {
  const [systemStatus, setSystemStatus] = useState<ProcessingSystemStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const { toast } = useToast();

  const getProcessingStats = async () => {
    setIsLoading(true);
    try {
      // Fetch message stats from the messages table
      const { data: msgStats, error: msgError } = await supabase
        .from('messages')
        .select(`
          processing_state,
          count(*)
        `)
        .not('processing_state', 'eq', 'deleted')
        .group('processing_state');

      if (msgError) throw msgError;

      // Get oldest pending message
      const { data: oldestMsg, error: oldestMsgError } = await supabase
        .from('messages')
        .select('created_at')
        .eq('processing_state', 'pending')
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      // Get recent errors
      const { data: recentErrors, error: errorsError } = await supabase
        .from('unified_audit_logs')
        .select('event_type, metadata, created_at, error_message')
        .in('event_type', ['message_processing_error', 'system_health_error', 'queue_processing_error'] as any[])
        .order('created_at', { ascending: false })
        .limit(10);

      // Process the stats
      let pendingCount = 0;
      let processingCount = 0;
      let errorCount = 0;
      let stalledCount = 0;

      msgStats?.forEach((stat) => {
        switch (stat.processing_state) {
          case 'pending':
            pendingCount = Number(stat.count);
            break;
          case 'processing':
            processingCount = Number(stat.count);
            break;
          case 'error':
            errorCount = Number(stat.count);
            break;
        }
      });

      // Calculate oldest pending message age in hours
      let oldestPendingAge = null;
      if (oldestMsg) {
        const oldestDate = new Date(oldestMsg.created_at);
        const ageMs = Date.now() - oldestDate.getTime();
        oldestPendingAge = ageMs / (1000 * 60 * 60); // convert to hours
      }

      // Format recent errors
      const formattedErrors = recentErrors?.map((err) => ({
        component: err.metadata?.component || 'Unknown',
        message: err.error_message || 'Unknown error',
        timestamp: err.created_at
      })) || [];

      // Build the system status object
      const status: ProcessingSystemStatus = {
        queue_health: true,
        queued_count: pendingCount,
        active_workers: 0,
        last_worker_activity: null,
        stalled_messages: stalledCount,
        pending_messages: pendingCount,
        processing_messages: processingCount,
        error_messages: errorCount,
        oldest_pending_message_age_hours: oldestPendingAge,
        recent_errors: formattedErrors
      };

      setSystemStatus(status);
    } catch (error) {
      console.error('Error fetching processing stats:', error);
      toast({
        title: 'Error fetching stats',
        description: 'Could not load processing system statistics',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const repairProcessingSystem = async () => {
    setIsRepairing(true);
    try {
      const { data, error } = await supabase.functions.invoke('repair-processing-flow', {
        body: { action: 'reset_stalled_messages' }
      });

      if (error) throw error;

      toast({
        title: 'System repair completed',
        description: `Reset ${data?.reset_count || 0} stalled messages and fixed ${data?.mixed_media_groups_fixed || 0} media groups`,
      });

      // Refresh stats
      getProcessingStats();
    } catch (error) {
      console.error('Error repairing processing system:', error);
      toast({
        title: 'Repair failed',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive'
      });
    } finally {
      setIsRepairing(false);
    }
  };

  const repairStuckMessages = async () => {
    setIsRepairing(true);
    try {
      const { data, error } = await supabase.functions.invoke('xdelo_direct_process_message', {
        body: { action: 'process_pending', limit: 20 }
      });

      if (error) throw error;

      toast({
        title: 'Message processing triggered',
        description: `Processed ${data?.processed_count || 0} messages`,
      });

      // Refresh stats
      getProcessingStats();
    } catch (error) {
      console.error('Error processing stuck messages:', error);
      toast({
        title: 'Processing failed',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive'
      });
    } finally {
      setIsRepairing(false);
    }
  };

  return { 
    systemStatus, 
    isLoading, 
    isRepairing, 
    getProcessingStats, 
    repairProcessingSystem, 
    repairStuckMessages 
  };
}
