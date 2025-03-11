
import React from 'react';
import { CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface MessageHeaderProps {
  lastRefresh: Date | null;
}

export const MessageHeader: React.FC<MessageHeaderProps> = ({ lastRefresh }) => {
  return (
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
  );
};
