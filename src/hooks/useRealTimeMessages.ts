
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Message, ProcessingState } from '@/types';

interface UseRealTimeMessagesProps {
  limit?: number;
  processingState?: ProcessingState[];
  sortBy?: 'created_at' | 'updated_at' | 'purchase_date';
  sortOrder?: 'asc' | 'desc';
}

export function useRealTimeMessages({
  limit = 100,
  processingState = [],
  sortBy = 'created_at',
  sortOrder = 'desc'
}: UseRealTimeMessagesProps = {}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchMessages = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      let query = supabase
        .from('v_messages_compatibility')
        .select('*')
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .limit(limit);
      
      if (processingState && processingState.length > 0) {
        query = query.in('processing_state', processingState);
      }
      
      const { data, error: queryError } = await query;
      
      if (queryError) {
        throw queryError;
      }
      
      // Add validation and default values for required fields
      const validMessages = (data || []).map((rawMessage: any): Message => ({
        id: rawMessage.id || `missing-id-${Date.now()}-${Math.random().toString(36).substring(2)}`,
        file_unique_id: rawMessage.file_unique_id || `missing-file-id-${Date.now()}`,
        public_url: rawMessage.public_url || '/placeholder.svg',
        // Include the rest of the message properties
        ...rawMessage
      }));
      
      setMessages(validMessages);
    } catch (err: any) {
      console.error('Error fetching messages:', err);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [limit, processingState, sortBy, sortOrder]);

  const handleRefresh = useCallback(async () => {
    await fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    fetchMessages();
    
    const subscription = supabase
      .channel('messages-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          fetchMessages();
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(subscription);
    };
  }, [fetchMessages]);

  return {
    messages,
    isLoading,
    error,
    handleRefresh
  };
}
