
import React, { useEffect, useState } from 'react';
import type { Message } from './types';
import { MessageList } from './MessageList';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/useToast';

export function MessageListContainer() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

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
      setMessages((data as unknown as Message[]) || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch messages');
    } finally {
      setLoading(false);
    }
  };

  const processAllMessages = async () => {
    try {
      setProcessing(true);
      let processedCount = 0;
      let errorCount = 0;

      const messagesToProcess = messages.filter(msg => msg.caption);
      if (messagesToProcess.length === 0) {
        toast("No Messages to Process", {
          description: "No messages with captions found."
        });
        return;
      }

      // Show initial toast
      toast("Processing Messages", {
        description: `Starting to process ${messagesToProcess.length} messages with captions...`
      });

      // Process messages in sequence
      for (const message of messagesToProcess) {
        try {
          console.log('Processing message:', { 
            id: message.id, 
            caption: message.caption,
            current_state: message.processing_state 
          });
          
          const { data, error: functionError } = await supabase.functions.invoke(
            'parse-caption-with-ai',
            {
              body: {
                messageId: message.id,
                media_group_id: message.media_group_id || null,
                caption: message.caption || '',
                correlation_id: crypto.randomUUID()
              }
            }
          );

          if (functionError) {
            console.error('Edge function error:', functionError);
            throw functionError;
          }

          console.log('Processing result:', data);
          processedCount++;
          
          // Update progress every 5 messages
          if (processedCount % 5 === 0) {
            toast("Processing Progress", {
              description: `Processed ${processedCount} of ${messagesToProcess.length} messages...`
            });
          }

          // Small delay to prevent overwhelming the function
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
          console.error('Error processing message:', message.id, error);
          errorCount++;
          
          toast("Message Processing Error", {
            description: `Failed to process message ${message.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            duration: 5000
          });
        }
      }

      // Show completion toast
      toast(
        errorCount > 0 ? "Processing Complete with Errors" : "Processing Complete",
        {
          description: `Successfully processed ${processedCount} messages. ${errorCount > 0 ? `Failed: ${errorCount}` : ''}`,
          duration: 5000
        }
      );

      // Refresh the list to show updated results
      await fetchMessages();
    } catch (error) {
      console.error('Error in batch processing:', error);
      toast("Processing Error", {
        description: error instanceof Error ? error.message : 'Failed to process messages',
        duration: 5000
      });
    } finally {
      setProcessing(false);
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
            setMessages(prev => [payload.new as Message, ...prev]);
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
        <div className="flex space-x-3">
          <button
            onClick={fetchMessages}
            disabled={processing}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Refresh List
          </button>
          <button
            onClick={processAllMessages}
            disabled={processing || messages.length === 0}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </>
            ) : (
              'Process All with AI'
            )}
          </button>
        </div>
      </div>
      <MessageList messages={messages} onRefresh={fetchMessages} />
    </div>
  );
} 
