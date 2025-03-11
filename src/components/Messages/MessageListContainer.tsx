
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { MessageList } from './MessageList';
import { Spinner } from '@/components/ui/spinner';
import { useMessageProcessing } from '@/hooks/useMessageProcessing';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, RefreshCw, Search } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProcessingRepairButton } from '@/components/ProductGallery/ProcessingRepairButton';
import { Input } from '@/components/ui/input';
import { debounce } from 'lodash';

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
  
  // Refactored fetch messages function with better error handling
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
  
  // Search function
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
  
  // Debounced search handler
  const debouncedSearch = useCallback(
    debounce((term: string) => {
      filterMessages(term);
    }, 300),
    [filterMessages]
  );
  
  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    debouncedSearch(value);
  };
  
  // Refresh function for manual refresh
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchMessages();
  }, [fetchMessages]);
  
  const handleProcessQueue = async () => {
    try {
      await processMessageQueue(10);
      // Refresh the list after processing
      handleRefresh();
    } catch (error) {
      console.error('Failed to process queue:', error);
    }
  };
  
  const handleQueueUnprocessed = async () => {
    try {
      await queueUnprocessedMessages(20);
      // Refresh the list after queueing
      handleRefresh();
    } catch (error) {
      console.error('Failed to queue unprocessed messages:', error);
    }
  };

  const handleRetryProcessing = async (messageId) => {
    try {
      // Get the message details for reanalysis
      const { data: messageData } = await supabase
        .from('messages')
        .select('*')
        .eq('id', messageId)
        .single();
      
      if (!messageData) {
        throw new Error('Message not found');
      }
      
      await handleReanalyze(messageData);
      // Refresh after processing
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
        <CardHeader className="pb-3">
          <CardTitle className="text-xl font-semibold flex items-center justify-between">
            <span>Messages Queue</span>
            {lastRefresh && (
              <span className="text-xs text-gray-500 font-normal">
                Last updated: {lastRefresh.toLocaleTimeString()}
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Process and monitor message processing from Telegram
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <div className="relative w-full sm:w-64 flex-shrink-0">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search messages..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="pl-9"
                />
              </div>
              
              <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isProcessingAny}
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={handleQueueUnprocessed}
                  disabled={isProcessingAny}
                >
                  {isProcessingAny && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Find Unprocessed
                </Button>
                <Button 
                  variant="default" 
                  size="sm"
                  onClick={handleProcessQueue}
                  disabled={isProcessingAny}
                >
                  {isProcessingAny && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Process Queue
                </Button>
              </div>
            </div>
            
            <ProcessingRepairButton />
          </div>
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
