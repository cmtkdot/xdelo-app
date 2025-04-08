
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MakeWebhookLog } from '@/types/make';
import { useToast } from '@/hooks/useToast';
import { useState } from 'react';

// Export the type for components to use
export type MakeEventLog = MakeWebhookLog;

/**
 * Hook to manage Make event logs
 */
export function useMakeEventLogs() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // State for pagination
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  // State for filtering
  const [timeFilter, setTimeFilter] = useState<{ from?: string; to?: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [eventTypeFilter, setEventTypeFilter] = useState<string | null>(null);
  const [webhookIdFilter, setWebhookIdFilter] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string | null>(null);

  // Fetch all event logs with pagination and filtering
  const useEventLogs = (params?: {
    eventType?: string | null;
    status?: 'success' | 'failed' | 'pending' | null;
    tags?: string[];
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }, enabled = true) => {
    const effectiveLimit = params?.limit || pageSize;
    const effectiveOffset = params?.offset || page * pageSize;
    
    return useQuery({
      queryKey: [
        'make-event-logs',
        params?.eventType || eventTypeFilter,
        params?.status || statusFilter,
        params?.tags,
        params?.startDate || timeFilter?.from,
        params?.endDate || timeFilter?.to,
        effectiveOffset,
        effectiveLimit,
        searchTerm,
      ],
      queryFn: async (): Promise<MakeWebhookLog[]> => {
        try {
          // Use any type to bypass TS errors with the table name
          let query = (supabase as any)
            .from('make_webhook_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .range(effectiveOffset, effectiveOffset + effectiveLimit - 1);

          // Apply event type filter
          if (params?.eventType || eventTypeFilter) {
            query = query.eq('event_type', params?.eventType || eventTypeFilter);
          }

          // Apply status filter
          if (params?.status || statusFilter) {
            query = query.eq('status', params?.status || statusFilter);
          }

          // Apply time filter
          if (params?.startDate || timeFilter?.from) {
            query = query.gte('created_at', params?.startDate || timeFilter?.from);
          }
          if (params?.endDate || timeFilter?.to) {
            query = query.lte('created_at', params?.endDate || timeFilter?.to);
          }

          // Apply tags filter
          if (params?.tags && params.tags.length > 0) {
            query = query.contains('tags', params.tags);
          }

          // Apply search term filter
          if (searchTerm) {
            query = query.ilike('payload', `%${searchTerm}%`);
          }

          const { data, error } = await query;

          if (error) throw error;
          return data as MakeWebhookLog[];
        } catch (error) {
          console.error("Error fetching event logs:", error);
          throw error;
        }
      },
      enabled,
    });
  };

  // Fetch event log by ID
  const useEventLog = (id: string, enabled = true) =>
    useQuery({
      queryKey: ['make-event-logs', id],
      queryFn: async (): Promise<MakeWebhookLog | null> => {
        try {
          const { data, error } = await (supabase as any)
            .from('make_webhook_logs')
            .select('*')
            .eq('id', id)
            .single();

          if (error) throw error;
          return data as MakeWebhookLog;
        } catch (error) {
          console.error("Error fetching event log:", error);
          throw error;
        }
      },
      enabled: !!id && enabled,
    });

  // Fetch event logs by webhook ID
  const useEventLogsByWebhookId = (webhookId: string, enabled = true) =>
    useQuery({
      queryKey: ['make-event-logs', 'webhook', webhookId],
      queryFn: async (): Promise<MakeWebhookLog[]> => {
        try {
          const { data, error } = await (supabase as any)
            .from('make_webhook_logs')
            .select('*')
            .eq('webhook_id', webhookId)
            .order('created_at', { ascending: false });

          if (error) throw error;
          return data as MakeWebhookLog[];
        } catch (error) {
          console.error("Error fetching webhook event logs:", error);
          throw error;
        }
      },
      enabled: !!webhookId && enabled,
    });

  // Retry a failed webhook event
  const retryFailedEvent = useMutation({
    mutationFn: async (logId: string) => {
      // Implement retry logic via edge function call
      const { data, error } = await supabase.functions.invoke('make-webhook-retry', {
        body: {
          logId,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['make-event-logs'] });
      toast({
        title: 'Success',
        description: 'Webhook event retried',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to retry webhook event: ${error instanceof Error ? error.message : String(error)}`,
        variant: 'destructive',
      });
    },
  });

  // Fetch total count of event logs
  const useEventLogsCount = (params?: {
    eventType?: string | null;
    status?: 'success' | 'failed' | 'pending' | null;
    tags?: string[];
    startDate?: string;
    endDate?: string;
  }, enabled = true) =>
    useQuery({
      queryKey: [
        'make-event-logs',
        'count',
        params?.eventType || eventTypeFilter,
        params?.status || statusFilter,
        params?.tags,
        params?.startDate || timeFilter?.from,
        params?.endDate || timeFilter?.to,
        searchTerm,
      ],
      queryFn: async (): Promise<number> => {
        try {
          let query = (supabase as any)
            .from('make_webhook_logs')
            .select('*', { count: 'exact' });

          // Apply event type filter
          if (params?.eventType || eventTypeFilter) {
            query = query.eq('event_type', params?.eventType || eventTypeFilter);
          }

          // Apply status filter
          if (params?.status || statusFilter) {
            query = query.eq('status', params?.status || statusFilter);
          }

          // Apply time filter
          if (params?.startDate || timeFilter?.from) {
            query = query.gte('created_at', params?.startDate || timeFilter?.from);
          }
          if (params?.endDate || timeFilter?.to) {
            query = query.lte('created_at', params?.endDate || timeFilter?.to);
          }

          // Apply tags filter
          if (params?.tags && params.tags.length > 0) {
            query = query.contains('tags', params.tags);
          }

          // Apply search term filter
          if (searchTerm) {
            query = query.ilike('payload', `%${searchTerm}%`);
          }

          const { count, error } = await query;

          if (error) throw error;
          return count || 0;
        } catch (error) {
          console.error("Error counting event logs:", error);
          throw error;
        }
      },
      enabled,
    });

  // Get status summary
  const useEventStatusSummary = (enabled = true) =>
    useQuery({
      queryKey: ['make-event-logs', 'status-summary'],
      queryFn: async (): Promise<Array<{ status: string; count: number }>> => {
        try {
          // This would typically be a database function or aggregation
          // Since it's not available, we'll simulate it with multiple queries
          const statuses = ['success', 'failed', 'pending'];
          const counts = await Promise.all(
            statuses.map(async (status) => {
              const { count, error } = await (supabase as any)
                .from('make_webhook_logs')
                .select('*', { count: 'exact' })
                .eq('status', status);
              
              if (error) throw error;
              return { status, count: count || 0 };
            })
          );
          
          return counts;
        } catch (error) {
          console.error("Error getting status summary:", error);
          throw error;
        }
      },
      enabled,
    });

  // Clear old event logs
  const clearEventLogs = useMutation({
    mutationFn: async (params?: { days?: number }) => {
      const days = params?.days || 30;
      const { data, error } = await supabase.functions.invoke('make-event-log-cleaner', {
        body: { olderThanDays: days }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['make-event-logs'] });
      toast({
        title: 'Success',
        description: 'Old event logs cleared successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to clear event logs: ${error instanceof Error ? error.message : String(error)}`,
        variant: 'destructive',
      });
    },
  });

  // Clear all filters
  const clearFilters = () => {
    setTimeFilter(null);
    setStatusFilter(null);
    setEventTypeFilter(null);
    setWebhookIdFilter(null);
    setSearchTerm(null);
    setPage(0);
  };

  return {
    useEventLogs,
    useEventLog,
    useEventLogsByWebhookId,
    retryFailedEvent,
    useEventLogsCount,
    useEventStatusSummary,
    clearEventLogs,
    page,
    setPage,
    pageSize,
    setPageSize,
    timeFilter,
    setTimeFilter,
    statusFilter,
    setStatusFilter,
    eventTypeFilter,
    setEventTypeFilter,
    webhookIdFilter,
    setWebhookIdFilter,
    searchTerm,
    setSearchTerm,
    clearFilters,
  };
}
