
import React from 'react';
import { MessageListContainer } from '../components/Messages/MessageListContainer';
import { MessagesTable } from "@/components/MessagesTable/MessagesTable";
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { MessageHealth } from '@/components/Messages/MessageHealth';
import { Card, CardContent } from '@/components/ui/card';
import { useRealTimeMessages } from '@/hooks/useRealTimeMessages';

export default function MessagesPage() {
  const { messages, isLoading, isRefreshing, handleRefresh } = useRealTimeMessages({ limit: 20 });

  return (
    <div className="container mx-auto">
      <Helmet>
        <title>Message Queue | Telegram Processing</title>
      </Helmet>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Message Processing Queue</h1>
      </div>
      
      <div className="space-y-6">
        <MessageHealth />
        <div className="flex flex-col space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Recent Messages</h2>
            <Button 
              onClick={handleRefresh}
              disabled={isRefreshing}
              variant="outline"
              size="sm"
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
          {isLoading ? (
            <div className="flex justify-center p-8">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <MessagesTable messages={messages} />
          )}
        </div>
      </div>
    </div>
  );
}
