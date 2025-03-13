import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/useToast';

interface EventLogParams {
  eventType?: string | null;
  status?: 'success' | 'failed' | 'pending' | null;
  webhookId?: string | null;
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
  tags?: string[];
}

export interface MakeEventLog {
  id: string;
  webhook_id?: string | null;
  event_type: string;
  payload: any;
  status: 'success' | 'failed' | 'pending';
  error_message?: string | null;
  request_headers?: any;
  response_code?: number | null;
  response_body?: string | null;
  response_headers?: any;
  duration_ms?: number | null;
  completed_at?: string | null;
  created_at: string;
  tags?: string[] | null;
  context?: any;
  severity?: string | null;
}

/**
 * Hook to manage Make event logs
 */
export function useMakeEventLogs() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch event logs with filtering
  const useEventLogs = (params: EventLogParams = {}) => {
    const { 
      eventType, 
      status, 
      webhookId, 
      limit = 50, 
      offset = 0,
      startDate,
      endDate,
      tags
    } = params;
    
    return useQuery({
      queryKey: ['make-event-logs', { eventType, status, webhookId, limit, offset, startDate, endDate, tags }],
      queryFn: async (): Promise<MakeEventLog[]> => {
        let query = supabase
          .from('make_event_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);
        
        if (eventType) {
          query = query.eq('event_type', eventType);
        }
        
        if (status) {
          query = query.eq('status', status);
        }
        
        if (webhookId) {
          query = query.eq('webhook_id', webhookId);
        }

        if (startDate) {
          query = query.gte('created_at', startDate);
        }

        if (endDate) {
          query = query.lte('created_at', endDate);
        }

        if (tags && tags.length > 0) {
          query = query.contains('tags', tags);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        return data;
      },
      refetchInterval: 5000, // Auto-refresh every 5 seconds
    });
  };

  // Get a count of event logs with filters
  const useEventLogsCount = (params: Omit<EventLogParams, 'limit' | 'offset'> = {}) => {
    const { eventType, status, webhookId, startDate, endDate, tags } = params;
    
    return useQuery({
      queryKey: ['make-event-logs-count', { eventType, status, webhookId, startDate, endDate, tags }],
      queryFn: async (): Promise<number> => {
        let query = supabase
          .from('make_event_logs')
          .select('id', { count: 'exact', head: true });
        
        if (eventType) {
          query = query.eq('event_type', eventType);
        }
        
        if (status) {
          query = query.eq('status', status);
        }
        
        if (webhookId) {
          query = query.eq('webhook_id', webhookId);
        }

        if (startDate) {
          query = query.gte('created_at', startDate);
        }

        if (endDate) {
          query = query.lte('created_at', endDate);
        }

        if (tags && tags.length > 0) {
          query = query.contains('tags', tags);
        }
        
        const { count, error } = await query;
        
        if (error) throw error;
        return count || 0;
      },
    });
  };

  // Get event log by ID
  const useEventLog = (id: string) => 
    useQuery({
      queryKey: ['make-event-log', id],
      queryFn: async (): Promise<MakeEventLog> => {
        const { data, error } = await supabase
          .from('make_event_logs')
          .select('*')
          .eq('id', id)
          .single();
        
        if (error) throw error;
        return data;
      },
      enabled: !!id,
    });

  // Get recent event status summary
  const useEventStatusSummary = () =>
    useQuery({
      queryKey: ['make-event-status-summary'],
      queryFn: async () => {
        const { data, error } = await supabase.rpc('get_make_event_status_summary');
        
        if (error) throw error;
        return data as { status: string; count: number }[];
      },
      refetchInterval: 5000, // Auto-refresh every 5 seconds
    });

  // Clear event logs
  const clearEventLogs = useMutation({
    mutationFn: async (params: { olderThan?: Date; webhookId?: string; status?: string }) => {
      const olderThan = params.olderThan ? params.olderThan.toISOString() : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase.rpc('make_clean_event_logs', {
        older_than: olderThan,
        webhook_id: params.webhookId || null,
        status: params.status || null
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['make-event-logs'] });
      queryClient.invalidateQueries({ queryKey: ['make-event-logs-count'] });
      queryClient.invalidateQueries({ queryKey: ['make-event-status-summary'] });
      toast({
        title: 'Success',
        description: `${data} event logs cleared`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to clear event logs: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Retry a failed webhook event
  const retryFailedEvent = useMutation({
    mutationFn: async (eventId: string) => {
      // Get the original event data
      const { data: eventData, error: eventError } = await supabase
        .from('make_event_logs')
        .select('*')
        .eq('id', eventId)
        .single();
      
      if (eventError) throw eventError;
      
      // Create a new event with the same payload
      const { data, error } = await supabase.functions.invoke('make_rule_engine', {
        body: {
          event_type: eventData.event_type,
          payload: eventData.payload,
          retry_of: eventId,
          context: {
            is_retry: true,
            original_event_id: eventId,
            ...eventData.context
          }
        }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['make-event-logs'] });
      toast({
        title: 'Success',
        description: 'Event retry initiated',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to retry event: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  return {
    useEventLogs,
    useEventLogsCount,
    useEventLog,
    useEventStatusSummary,
    clearEventLogs,
    retryFailedEvent
  };
} 