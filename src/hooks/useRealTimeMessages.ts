
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Message } from '@/types';
import { ProcessingState } from '@/types';

export type ProcessingStateType = ProcessingState;

interface RealTimeMessagesOptions {
  limit?: number;
  states?: ProcessingState[];
  chatId?: number;
  filter?: string;
  processingState?: ProcessingStateType[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  showForwarded?: boolean;
  showEdited?: boolean;
}

export default function useRealTimeMessages({ 
  limit = 20, 
  states = ["initialized", "pending", "processing", "completed", "error", "partial_success"] as ProcessingState[], 
  chatId,
  filter = '',
  processingState,
  sortBy = 'updated_at',
  sortOrder = 'desc',
  showForwarded = false,
  showEdited = false
}: RealTimeMessagesOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Use the provided processingState or fall back to states
  const effectiveStates = processingState || states;

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setOffset(0);
    setHasMore(true);
    fetchMessages(0)
      .finally(() => {
        setIsRefreshing(false);
        setLastRefresh(new Date());
      });
  }, []);

  useEffect(() => {
    setMessages([]);
    setOffset(0);
    setHasMore(true);
    fetchMessages(0);
  }, [limit, effectiveStates, chatId, filter, sortBy, sortOrder, showForwarded, showEdited]);

  useEffect(() => {
    const channel = supabase
      .channel('public:messages')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload) => {
          console.log('Change received!', payload);
          if (payload.eventType === 'INSERT') {
            const newMessage = payload.new as Message;
            if (effectiveStates.includes(newMessage.processing_state as ProcessingState)) {
              setMessages((prevMessages) => [newMessage, ...prevMessages]);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedMessage = payload.new as Message;
            setMessages((prevMessages) =>
              prevMessages.map((message) =>
                message.id === updatedMessage.id ? updatedMessage : message
              )
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedMessageId = payload.old.id;
            setMessages((prevMessages) =>
              prevMessages.filter((message) => message.id !== deletedMessageId)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [effectiveStates]);

  const fetchMessages = useCallback(async (newOffset?: number) => {
    setLoading(true);
    setError(null);
    
    try {
      let query = supabase
        .from('messages')
        .select('*, other_messages(*)')
        .in('processing_state', effectiveStates)
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .limit(limit);
      
      if (chatId) {
        query = query.eq('chat_id', chatId);
      }
      
      if (filter && filter.trim() !== '') {
        query = query.ilike('caption', `%${filter}%`);
      }
      
      if (showForwarded) {
        query = query.eq('is_forward', true);
      }
      
      if (showEdited) {
        query = query.gt('edit_count', 0);
      }

      if (newOffset !== undefined) {
        query = query.range(newOffset, newOffset + limit - 1);
      } else {
        query = query.range(offset, offset + limit - 1);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      const fetchedMessages = data as Message[];

      if (newOffset !== undefined) {
        setMessages((prevMessages) => [...prevMessages, ...fetchedMessages]);
        setOffset(newOffset + limit);
      } else {
        setMessages((prevMessages) => (offset === 0 ? fetchedMessages : [...prevMessages, ...fetchedMessages]));
        setOffset(offset + limit);
      }

      if (fetchedMessages.length < limit) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [limit, effectiveStates, chatId, filter, sortBy, sortOrder, showForwarded, showEdited, offset]);

  const loadMore = () => {
    if (hasMore && !loading) {
      fetchMessages(offset);
    }
  };

  return { 
    messages, 
    loading, 
    error, 
    loadMore, 
    hasMore, 
    isRefreshing, 
    lastRefresh, 
    handleRefresh, 
    isLoading: loading 
  };
}
