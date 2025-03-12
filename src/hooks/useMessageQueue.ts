
import { useState, useEffect } from 'react';
import { useSupabase } from '@/integrations/supabase/SupabaseProvider';
import { Message, MessageProcessingStats } from '@/types/MessagesTypes';

interface UseMessageQueueReturnType {
  messages: Message[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  isRefetching: boolean;
  stats: MessageProcessingStats;
  handleRefresh: () => Promise<void>;
}

export const useMessageQueue = (): UseMessageQueueReturnType => {
  const { supabase } = useSupabase();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefetching, setIsRefetching] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [stats, setStats] = useState<MessageProcessingStats>({
    state_counts: {
      pending: 0,
      processing: 0,
      completed: 0,
      error: 0,
      total_messages: 0
    }
  });

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Cast data to Message[] explicitly to handle the processing_state type properly
      setMessages(data as unknown as Message[]);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching messages'));
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      // Use the database function to get message processing stats
      const { data, error } = await supabase.rpc('xdelo_get_message_processing_stats');
      
      if (error) throw error;
      
      if (data) {
        // Map the stats data to our MessageProcessingStats interface
        const processedStats: MessageProcessingStats = {
          state_counts: {
            total_messages: data.state_counts?.total_messages || 0,
            pending: data.state_counts?.pending || 0,
            processing: data.state_counts?.processing || 0,
            completed: data.state_counts?.completed || 0,
            error: data.state_counts?.error || 0,
          },
          media_group_stats: {
            unprocessed_with_caption: data.media_group_stats?.unprocessed_with_caption || 0,
            stuck_in_processing: data.media_group_stats?.stuck_in_processing || 0,
            stalled_no_media_group: data.media_group_stats?.stalled_no_media_group || 0,
            orphaned_media_group_messages: data.media_group_stats?.orphaned_media_group_messages || 0
          },
          timing_stats: {
            avg_processing_time_seconds: data.timing_stats?.avg_processing_time_seconds || 0,
            oldest_unprocessed_caption_age_hours: data.timing_stats?.oldest_unprocessed_caption_age_hours || 0,
            oldest_stuck_processing_hours: data.timing_stats?.oldest_stuck_processing_hours || 0
          },
          media_type_counts: data.media_type_counts || {
            photo_count: 0,
            video_count: 0,
            document_count: 0,
            other_count: 0
          },
          processing_stats: data.processing_stats || {
            avg_processing_seconds: 0,
            max_processing_seconds: 0
          },
          timestamp: data.timestamp
        };
        
        setStats(processedStats);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
      // Don't set error state for stats, just log it
    }
  };

  const handleRefresh = async () => {
    setIsRefetching(true);
    await Promise.all([fetchMessages(), fetchStats()]);
    setIsRefetching(false);
  };

  useEffect(() => {
    fetchMessages();
    fetchStats();
  }, []);

  const refetch = async () => {
    await fetchMessages();
  };

  return {
    messages,
    isLoading,
    error,
    refetch,
    isRefetching,
    stats,
    handleRefresh
  };
};
