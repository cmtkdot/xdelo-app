
import React, { useState, useEffect, useCallback } from 'react';
import { MessageList } from './MessageList';
import { Spinner } from '@/components/ui/spinner';
import { useMessageProcessing } from '@/hooks/useMessageProcessing';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/useToast';
import { Card, CardContent } from '@/components/ui/card';
import { debounce } from 'lodash';
import { MessageHeader } from './MessageHeader';
import { MessageControlPanel } from './MessageControlPanel';

export const MessageListContainer: React.FC = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [messages, setMessages] = useState([]);
  const [filteredMessages, setFilteredMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  
  const { 
    handleReanalyze, 
    processMessageQueue,
    queueUnprocessedMessages,
    isProcessing: processingState
  } = useMessageProcessing();
  
  const fetchMessages = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
        
      if (error) throw error;
      setMessages(data || []);
      setFilteredMessages(data || []);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast({
        title: "Error Loading Messages",
        description: error.message || "An error occurred while loading messages",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [toast]);
  
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);
  
  const filterMessages = useCallback((term: string) => {
    if (!term.trim()) {
      setFilteredMessages(messages);
      return;
    }
    
    const termLower = term.toLowerCase();
    const filtered = messages.filter(message => {
      return (
        message.caption?.toLowerCase().includes(termLower) ||
        message.analyzed_content?.product_name?.toLowerCase().includes(termLower) ||
        message.analyzed_content?.vendor_uid?.toLowerCase().includes(termLower) ||
        message.analyzed_content?.product_code?.toLowerCase().includes(termLower) ||
        message.telegram_message_id?.toString().includes(termLower) ||
        message.chat_title?.toLowerCase().includes(termLower)
      );
    });
    
    setFilteredMessages(filtered);
  }, [messages]);
  
  const debouncedSearch = useCallback(
    debounce((term: string) => {
      filterMessages(term);
    }, 300),
    [filterMessages]
  );
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    debouncedSearch(value);
  };
  
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchMessages();
  }, [fetchMessages]);
  
  const handleProcessQueue = async () => {
    try {
      await processMessageQueue(10);
      handleRefresh();
    } catch (error) {
      console.error('Failed to process queue:', error);
    }
  };
  
  const handleQueueUnprocessed = async () => {
    try {
      await queueUnprocessedMessages(20);
      handleRefresh();
    } catch (error) {
      console.error('Failed to queue unprocessed messages:', error);
    }
  };

  const handleRetryProcessing = async (messageId) => {
    try {
      const { data: messageData } = await supabase
        .from('messages')
        .select('*')
        .eq('id', messageId)
        .single();
      
      if (!messageData) {
        throw new Error('Message not found');
      }
      
      await handleReanalyze(messageData);
      handleRefresh();
    } catch (error) {
      console.error('Error retrying message processing:', error);
      toast({
        title: "Retry Failed",
        description: error.message || "Failed to retry processing",
        variant: "destructive"
      });
    }
  };
  
  const isProcessingAny = Object.values(processingState).some(state => state) || isRefreshing;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <MessageHeader lastRefresh={lastRefresh} />
        <CardContent>
          <MessageControlPanel 
            searchTerm={searchTerm}
            onSearchChange={handleSearchChange}
            onRefresh={handleRefresh}
            onQueueUnprocessed={handleQueueUnprocessed}
            onProcessQueue={handleProcessQueue}
            isProcessingAny={isProcessingAny}
            isRefreshing={isRefreshing}
          />
        </CardContent>
      </Card>
      
      {isRefreshing ? (
        <div className="flex items-center justify-center p-8">
          <Spinner size="lg" />
        </div>
      ) : (
        <MessageList 
          messages={filteredMessages}
          isLoading={isLoading}
          onRetryProcessing={handleRetryProcessing}
          onProcessAll={handleProcessQueue}
          processAllLoading={isProcessingAny}
        />
      )}
    </div>
  );
};
