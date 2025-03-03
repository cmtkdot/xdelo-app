
import { useEffect, useState } from 'react';
import type { Message } from './types';
import { MessageList } from './MessageList';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/useToast';
import { Button } from '../ui/button';
import { RefreshCw, PlayCircle, AlertCircle } from 'lucide-react';

export function MessageListContainer() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });
  const { toast } = useToast();

  const fetchMessages = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching messages...');
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Fetched messages:', { count: data?.length });
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
      
      const messagesToProcess = messages.filter(msg => 
        msg.caption && 
        (!msg.processing_state || ['pending', 'error', 'initialized'].includes(msg.processing_state))
      );
      
      if (messagesToProcess.length === 0) {
        toast({
          title: "No Messages to Process",
          description: "No messages with captions found that need processing."
        });
        return;
      }

      setProcessingProgress({ current: 0, total: messagesToProcess.length });
      
      // Show initial toast
      toast({
        title: "Processing Messages",
        description: `Queuing ${messagesToProcess.length} messages with captions...`
      });

      // Queue all messages first
      for (const [index, message] of messagesToProcess.entries()) {
        try {
          // Queue the message using database function
          await supabase.rpc(
            'xdelo_queue_message_for_processing',
            {
              p_message_id: message.id,
              p_correlation_id: crypto.randomUUID()
            }
          );
          
          setProcessingProgress({ current: index + 1, total: messagesToProcess.length });
          
          // Update progress every 5 messages
          if ((index + 1) % 5 === 0 || index === messagesToProcess.length - 1) {
            toast({
              title: "Queueing Progress",
              description: `Queued ${index + 1} of ${messagesToProcess.length} messages`
            });
          }
          
          // Small delay to prevent overwhelming the database
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error(`Error queueing message ${message.id}:`, error);
        }
      }

      // Now process the queue
      try {
        toast({
          title: "Processing Queue",
          description: `Starting to process the queue with ${messagesToProcess.length} messages...`
        });
        
        // Call process-message-queue with a higher limit
        const { data, error } = await supabase.functions.invoke('process-message-queue', {
          body: { limit: Math.min(messagesToProcess.length, 20) }
        });
        
        if (error) throw error;
        
        toast({
          title: "Processing Complete",
          description: `Processed ${data?.processed || 0} messages: ${data?.success || 0} succeeded, ${data?.failed || 0} failed.`
        });
        
      } catch (error) {
        console.error('Error processing queue:', error);
        toast({
          title: "Processing Error",
          description: error instanceof Error ? error.message : 'Failed to process message queue',
          variant: "destructive"
        });
      }

      // Refresh messages to show updated results
      await fetchMessages();
      
    } catch (error) {
      console.error('Error in batch processing:', error);
      toast({
        title: "Processing Error",
        description: error instanceof Error ? error.message : 'Failed to process messages',
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
      setProcessingProgress({ current: 0, total: 0 });
    }
  };

  const handleReanalyze = async (messageId: string) => {
    try {
      toast({
        title: "Reanalyzing Message",
        description: "Requesting analysis for the selected message..."
      });
      
      // Queue the message
      const { error: queueError } = await supabase.rpc(
        'xdelo_queue_message_for_processing',
        {
          p_message_id: messageId,
          p_correlation_id: crypto.randomUUID()
        }
      );
      
      if (queueError) throw queueError;
      
      // Process the queue for this message
      const { data, error } = await supabase.functions.invoke('process-message-queue', {
        body: { limit: 1 }
      });
      
      if (error) throw error;
      
      toast({
        title: "Analysis Complete",
        description: "The message has been analyzed."
      });
      
      // Refresh to show updated results
      await fetchMessages();
      
    } catch (error) {
      console.error('Error reanalyzing message:', error);
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : 'Failed to analyze message',
        variant: "destructive"
      });
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
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin mr-2">
          <RefreshCw size={24} />
        </div>
        <p>Loading messages...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="sm:flex sm:items-start sm:justify-between">
            <div className="flex items-center">
              <AlertCircle className="h-6 w-6 text-red-500 mr-2" />
              <div>
                <h3 className="text-lg font-medium leading-6 text-gray-900">Error Loading Messages</h3>
                <div className="mt-2 max-w-xl text-sm text-gray-500">
                  <p>{error}</p>
                </div>
              </div>
            </div>
            <div className="mt-5 sm:mt-0 sm:ml-6 sm:flex sm:flex-shrink-0 sm:items-center">
              <Button
                onClick={fetchMessages}
                variant="default"
                size="sm"
                className="inline-flex items-center px-4 py-2"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
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
        <div className="flex space-x-3 mt-4 sm:mt-0">
          <Button
            onClick={fetchMessages}
            disabled={processing}
            variant="outline"
            size="sm"
            className="inline-flex items-center"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh List
          </Button>
          <Button
            onClick={processAllMessages}
            disabled={processing || messages.length === 0}
            variant="default"
            size="sm"
            className="inline-flex items-center"
          >
            {processing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                {processingProgress.current > 0 ? 
                  `Processing ${processingProgress.current}/${processingProgress.total}...` : 
                  "Processing..."}
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4 mr-2" />
                Process All Messages
              </>
            )}
          </Button>
        </div>
      </div>
      <MessageList 
        messages={messages} 
        onRefresh={fetchMessages} 
        onReanalyze={handleReanalyze} 
      />
    </div>
  );
}
