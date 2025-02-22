import React, { useEffect, useState } from 'react';
import type { MessageData } from './types';
import { MessageList } from './MessageList';
import { supabase } from '@/integrations/supabase/client';

export function MessageListContainer() {
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching messages...');
      const { data, error, count } = await supabase
        .from('messages')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Fetched messages:', { count, messages: data?.length });
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch messages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();

    // Subscribe to realtime updates
    console.log('Setting up realtime subscription...');
    const channel = supabase
      .channel('messages_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'messages' 
        }, 
        (payload) => {
          console.log('Realtime update received:', payload);
          if (payload.eventType === 'INSERT') {
            setMessages(prev => [payload.new as MessageData, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setMessages(prev => 
              prev.map(msg => 
                msg.id === payload.new.id ? { ...msg, ...payload.new } : msg
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setMessages(prev => 
              prev.filter(msg => msg.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    return () => {
      console.log('Cleaning up subscription...');
      channel.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg">
        <div className="border-b border-gray-200 px-4 py-5 sm:px-6">
          <div className="h-6 w-48 bg-gray-200 rounded animate-pulse"></div>
        </div>
        <div className="px-4 py-6 sm:px-6">
          <div className="space-y-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex space-x-4">
                <div className="w-24 h-24 bg-gray-200 rounded animate-pulse"></div>
                <div className="flex-1 space-y-3">
                  <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 w-1/2 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 w-1/4 bg-gray-200 rounded animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="sm:flex sm:items-start sm:justify-between">
            <div>
              <h3 className="text-lg font-medium leading-6 text-gray-900">Error Loading Messages</h3>
              <div className="mt-2 max-w-xl text-sm text-gray-500">
                <p>{error}</p>
              </div>
            </div>
            <div className="mt-5 sm:mt-0 sm:ml-6 sm:flex sm:flex-shrink-0 sm:items-center">
              <button
                onClick={fetchMessages}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-medium text-gray-900">Messages</h2>
          <p className="mt-1 text-sm text-gray-500">
            A list of all messages and their processing status.
          </p>
        </div>
        <div>
          <button
            onClick={fetchMessages}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Refresh List
          </button>
        </div>
      </div>
      <MessageList messages={messages} onRefresh={fetchMessages} />
    </div>
  );
} 