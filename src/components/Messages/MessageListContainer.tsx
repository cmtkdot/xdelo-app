
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MessageList } from './MessageList';
import { Message } from '@/types';
import { toast } from 'sonner';

export const MessageListContainer: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processAllLoading, setProcessAllLoading] = useState(false);

  const fetchMessages = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setMessages(data as Message[]);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();

    // Subscribe to realtime updates
    const subscription = supabase
      .channel('messages_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'messages' 
      }, (payload) => {
        // Update UI based on the change
        if (payload.eventType === 'INSERT') {
          setMessages(prev => [payload.new as Message, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setMessages(prev => 
            prev.map(msg => msg.id === payload.new.id ? (payload.new as Message) : msg)
          );
        } else if (payload.eventType === 'DELETE') {
          setMessages(prev => prev.filter(msg => msg.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleRetryProcessing = async (messageId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('parse-caption-with-ai', {
        body: {
          messageId,
          retrieveFromDb: true
        }
      });

      if (error) throw error;
      
      // Optimistically update the UI
      setMessages(prev =>
        prev.map(msg => 
          msg.id === messageId
            ? { ...msg, processing_state: 'completed', analyzed_content: data.data }
            : msg
        )
      );
      
      return data;
    } catch (error) {
      console.error('Error processing message:', error);
      throw error;
    }
  };

  const handleProcessAll = async () => {
    setProcessAllLoading(true);
    try {
      // First queue all unprocessed messages
      const { data: queueData, error: queueError } = await supabase.functions.invoke('process-unanalyzed-messages', {
        body: { limit: 20 }
      });
      
      if (queueError) throw queueError;
      
      // Then process the queue
      const { data: processData, error: processError } = await supabase.functions.invoke('process-message-queue', {
        body: { limit: 20 }
      });
      
      if (processError) throw processError;
      
      // Refresh the messages list
      await fetchMessages();
      
      toast.success(`Processed ${processData?.data?.processed || 0} messages`);
    } catch (error) {
      console.error('Error processing all messages:', error);
      toast.error('Failed to process messages');
    } finally {
      setProcessAllLoading(false);
    }
  };

  return (
    <MessageList 
      messages={messages} 
      isLoading={isLoading} 
      onRetryProcessing={handleRetryProcessing}
      onProcessAll={handleProcessAll}
      processAllLoading={processAllLoading}
    />
  );
};
