
import React from 'react';
import { ActionButtons } from './ActionButtons';

interface MessageControlPanelProps {
  onRefresh: () => void;
  isRefreshing: boolean;
  messageCount: number;
}

export const MessageControlPanel: React.FC<MessageControlPanelProps> = ({
  onRefresh,
  isRefreshing,
  messageCount
}) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-background p-4 rounded-lg border">
      <div>
        <h2 className="text-xl font-semibold">Message Processing</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {messageCount} messages in queue
        </p>
      </div>
      
      <ActionButtons 
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
      />
    </div>
  );
};
