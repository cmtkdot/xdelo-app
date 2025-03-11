import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Message } from '@/types';
import { ProcessingState } from '@/types';

interface RealTimeMessagesOptions {
  limit?: number;
  states?: ProcessingState[];
  chatId?: number;
}

export default function useRealTimeMessages({ 
  limit = 20, 
  states = ["initialized", "pending", "processing", "completed", "error", "partial_success"] as ProcessingState[], 
  chatId 
}: RealTimeMessagesOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    setMessages([]);
    setOffset(0);
    setHasMore(true);
    fetchMessages(0);
  }, [limit, states, chatId]);

  useEffect(() => {
    const channel = supabase
      .channel('public:messages')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload) => {
          console.log('Change received!', payload)
          if (payload.eventType === 'INSERT') {
            const newMessage = payload.new as Message;
            if (states.includes(newMessage.processing_state)) {
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
  }, []);

  const fetchMessages = useCallback(async (newOffset?: number) => {
    setLoading(true);
    setError(null);
    
    try {
      let query = supabase
        .from('messages')
        .select('*, other_messages(*)')
        .in('processing_state', states as readonly ProcessingState[])
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (chatId) {
        query = query.eq('chat_id', chatId);
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
  }, [limit, states, chatId]);

  const loadMore = () => {
    if (hasMore && !loading) {
      fetchMessages(offset);
    }
  };

  return { messages, loading, error, loadMore, hasMore };
}
