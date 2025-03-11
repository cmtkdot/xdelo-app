
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';

export interface ProcessingSystemStatus {
  queue_health: 'healthy' | 'warning' | 'error';
  queued_count: number;
  active_workers: number;
  last_worker_activity: string;
  recent_errors?: Array<{
    component: string;
    message: string;
    timestamp: string;
  }>;
}

export function useProcessingSystem() {
  const [isRepairing, setIsRepairing] = useState(false);
  const { toast } = useToast();

  const getProcessingStats = async (): Promise<ProcessingSystemStatus> => {
    try {
      const { data, error } = await supabase
        .from('system_health')
        .select('*')
        .single();

      if (error) throw error;

      // If we don't have data, return a default status
      if (!data) {
        return {
          queue_health: 'warning',
          queued_count: 0,
          active_workers: 0,
          last_worker_activity: 'Unknown',
          recent_errors: []
        };
      }

      // Get recent errors
      const { data: recentErrors } = await supabase
        .from('unified_audit_logs')
        .select('event_type, metadata, created_at')
        .in('event_type', ['processing_error', 'system_error', 'queue_error'])
        .order('created_at', { ascending: false })
        .limit(5);

      return {
        ...data,
        recent_errors: recentErrors?.map(err => ({
          component: err.event_type,
          message: err.metadata?.message || 'Unknown error',
          timestamp: err.created_at
        })) || []
      };
    } catch (error) {
      console.error('Error fetching processing stats:', error);
      return {
        queue_health: 'error',
        queued_count: 0,
        active_workers: 0,
        last_worker_activity: 'Error fetching data',
        recent_errors: [{
          component: 'system',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }]
      };
    }
  };

  const repairProcessingSystem = async () => {
    setIsRepairing(true);
    try {
      const { data, error } = await supabase
        .functions.invoke('repair-processing-flow', {
          body: { repair_limit: 100, repair_enums: true }
        });

      if (error) throw error;

      toast({
        title: 'Processing System Repair',
        description: `Repair completed successfully. ${data?.processed || 0} messages reset.`,
      });

      return data;
    } catch (error) {
      console.error('Error repairing processing system:', error);
      toast({
        title: 'Repair Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsRepairing(false);
    }
  };

  const repairStuckMessages = async () => {
    setIsRepairing(true);
    try {
      const { data, error } = await supabase
        .functions.invoke('repair-processing-flow', {
          body: { repair_limit: 50, repair_enums: false }
        });

      if (error) throw error;

      toast({
        title: 'Stuck Messages Reset',
        description: `Successfully reset ${data?.processed || 0} stuck messages.`,
      });

      return data;
    } catch (error) {
      console.error('Error resetting stuck messages:', error);
      toast({
        title: 'Reset Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsRepairing(false);
    }
  };

  return {
    getProcessingStats,
    repairProcessingSystem,
    repairStuckMessages,
    isRepairing
  };
}
