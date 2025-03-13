import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MakeWebhookLog } from '@/types/make';
import { useToast } from '@/hooks/useToast';
import { useState } from 'react';

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
  const useEventLogs = (enabled = true) =>
    useQuery({
      queryKey: [
        'make-event-logs',
        page,
        pageSize,
        timeFilter?.from,
        timeFilter?.to,
        statusFilter,
        eventTypeFilter,
        webhookIdFilter,
        searchTerm,
      ],
      queryFn: async (): Promise<MakeWebhookLog[]> => {
        let query = supabase
          .from('make_webhook_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        // Apply time filter
        if (timeFilter?.from) {
          query = query.gte('created_at', timeFilter.from);
        }
        if (timeFilter?.to) {
          query = query.lte('created_at', timeFilter.to);
        }

        // Apply status filter
        if (statusFilter) {
          query = query.eq('status', statusFilter);
        }

        // Apply event type filter
        if (eventTypeFilter) {
          query = query.eq('event_type', eventTypeFilter);
        }

        // Apply webhook ID filter
        if (webhookIdFilter) {
          query = query.eq('webhook_id', webhookIdFilter);
        }

        // Apply search term filter
        if (searchTerm) {
          query = query.ilike('payload', `%${searchTerm}%`);
        }

        const { data, error } = await query;

        if (error) throw error;
        return data;
      },
      enabled,
    });

  // Fetch event log by ID
  const useEventLog = (id: string, enabled = true) =>
    useQuery({
      queryKey: ['make-event-logs', id],
      queryFn: async (): Promise<MakeWebhookLog | null> => {
        const { data, error } = await supabase
          .from('make_webhook_logs')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        return data;
      },
      enabled,
    });

  // Fetch event logs by webhook ID
  const useEventLogsByWebhookId = (webhookId: string, enabled = true) =>
    useQuery({
      queryKey: ['make-event-logs', 'webhook', webhookId],
      queryFn: async (): Promise<MakeWebhookLog[]> => {
        const { data, error } = await supabase
          .from('make_webhook_logs')
          .select('*')
          .eq('webhook_id', webhookId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
      },
      enabled,
    });

  // Retry a failed webhook event
  const retryWebhookEvent = useMutation({
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
        description: `Failed to retry webhook event: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Fetch total count of event logs
  const useEventLogsCount = (enabled = true) =>
    useQuery({
      queryKey: ['make-event-logs', 'count'],
      queryFn: async (): Promise<number> => {
        let query = supabase
          .from('make_webhook_logs')
          .select('*', { count: 'exact' });

        // Apply time filter
        if (timeFilter?.from) {
          query = query.gte('created_at', timeFilter.from);
        }
        if (timeFilter?.to) {
          query = query.lte('created_at', timeFilter.to);
        }

        // Apply status filter
        if (statusFilter) {
          query = query.eq('status', statusFilter);
        }

        // Apply event type filter
        if (eventTypeFilter) {
          query = query.eq('event_type', eventTypeFilter);
        }

        // Apply webhook ID filter
        if (webhookIdFilter) {
          query = query.eq('webhook_id', webhookIdFilter);
        }

         // Apply search term filter
         if (searchTerm) {
          query = query.ilike('payload', `%${searchTerm}%`);
        }

        const { count, error } = await query;

        if (error) throw error;
        return count || 0;
      },
      enabled,
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
    retryWebhookEvent,
    useEventLogsCount,
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
