import React, { useState } from 'react';
import { MessageList } from './MessageList';
import { Card, CardContent } from '@/components/ui/card';
import { MessageHeader } from './MessageHeader';
import { MessageControlPanel } from './MessageControlPanel';
import { MessagesFilter, MessageFilterValues } from './MessagesFilter';
import { useRealTimeMessages } from '@/hooks/useRealTimeMessages';
import { useMessageQueue } from '@/hooks/useMessageQueue';
import { useToast } from '@/hooks/useToast';
import { ProcessingState } from '@/types';

export const MessageListContainer: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<MessageFilterValues>({
    processingState: [],
    sortBy: 'updated_at',
    sortOrder: 'desc',
    showForwarded: false,
    showEdited: false
  });
  const [showFilters, setShowFilters] = useState(false);
  const { toast } = useToast();
  
  const { 
    messages,
    isLoading,
    isRefreshing,
    lastRefresh,
    handleRefresh
  } = useRealTimeMessages({ 
    filter: searchTerm,
    processingState: filters.processingState as ProcessingState[],
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
    showForwarded: filters.showForwarded,
    showEdited: filters.showEdited
  });
  
  const { 
    processMessageById,
    isProcessing 
  } = useMessageQueue();

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleFilterChange = (newFilters: MessageFilterValues) => {
    setFilters(newFilters);
  };

  const handleToggleFilters = () => {
    setShowFilters(!showFilters);
  };

  const handleRetryProcessing = async (messageId) => {
    try {
      await processMessageById(messageId);
      handleRefresh();
    } catch (error) {
      console.error('Error retrying message processing:', error);
    }
  };
  
  const isProcessingAny = isProcessing || isRefreshing;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <MessageHeader lastRefresh={lastRefresh} />
        <CardContent>
          <MessageControlPanel 
            searchTerm={searchTerm}
            onSearchChange={handleSearchChange}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
            onToggleFilters={handleToggleFilters}
            showFilters={showFilters}
          />
          
          {showFilters && (
            <div className="mt-4 pt-4 border-t">
              <MessagesFilter 
                filters={filters}
                onFilterChange={handleFilterChange}
              />
            </div>
          )}
        </CardContent>
      </Card>
      
      <MessageList 
        messages={messages}
        isLoading={isLoading}
        onRetryProcessing={handleRetryProcessing}
        processAllLoading={isProcessingAny}
      />
    </div>
  );
};
