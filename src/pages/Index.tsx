
import React from 'react';
import { Helmet } from 'react-helmet';
import { MessagesTable } from "@/components/MessagesTable/MessagesTable";
import { Button } from '@/components/ui/button';
import { useRealTimeMessages } from '@/hooks/useRealTimeMessages';

export default function Index() {
  const { messages, isLoading, isRefreshing, handleRefresh } = useRealTimeMessages({ limit: 10 });

  return (
    <div className="container mx-auto py-6">
      <Helmet>
        <title>Home | Telegram Processing</title>
      </Helmet>
      
      <div className="space-y-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Dashboard</h1>
        </div>
        
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
