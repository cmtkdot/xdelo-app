
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Message, MessageProcessingStats, ProcessingState } from '@/types';
import { toast } from 'sonner';

export function useMessageQueue() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isRefetching, setIsRefetching] = useState(false);
  const [stats, setStats] = useState<MessageProcessingStats>({
    total: 0,
    pending: 0,
    processing: 0,
    completed: 0,
    error: 0,
    by_processing_state: {
      pending: 0,
      processing: 0,
      completed: 0,
      error: 0
    },
    by_media_type: {
      photo: 0,
      video: 0,
      document: 0,
      other: 0
    },
    processing_times: {
      avg_seconds: 0,
      max_seconds: 0
    },
    latest_update: ''
  });

  const fetchMessages = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        throw error;
      }

      setMessages(data);
      return data;
    } catch (error) {
      setError(error as Error);
      console.error('Error fetching messages:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  const fetchStats = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_message_processing_stats');
      
      if (error) throw error;
      
      // Map the stats to our expected format
      const mappedStats: MessageProcessingStats = {
        total: data.total || 0,
        pending: data.pending || 0,
        processing: data.processing || 0,
        completed: data.completed || 0,
        error: data.error || 0,
        by_processing_state: {
          pending: data.pending || 0,
          processing: data.processing || 0,
          completed: data.completed || 0,
          error: data.error || 0
        },
        by_media_type: {
          photo: data.photo_count || 0,
          video: data.video_count || 0,
          document: data.document_count || 0,
          other: data.other_count || 0
        },
        processing_times: {
          avg_seconds: data.avg_processing_seconds || 0,
          max_seconds: data.max_processing_seconds || 0
        },
        latest_update: new Date().toISOString()
      };
      
      setStats(mappedStats);
      return mappedStats;
    } catch (error) {
      console.error('Error fetching stats:', error);
      return null;
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefetching(true);
    try {
      await fetchMessages();
      await fetchStats();
    } finally {
      setIsRefetching(false);
    }
  }, [fetchMessages, fetchStats]);

  useEffect(() => {
    fetchMessages();
    fetchStats();
  }, [fetchMessages, fetchStats]);

  return {
    messages,
    isLoading,
    error,
    refetch: handleRefresh,
    isRefetching,
    stats,
    handleRefresh
  };
}

// Export the hook with xdelo_ prefix for consistency
export const xdelo_useMessageQueue = useMessageQueue;
