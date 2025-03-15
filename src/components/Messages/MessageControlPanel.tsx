
import React from 'react';
import { Button } from '@/components/ui/button';
import { ActionButtons } from './ActionButtons';
import { MediaFixButton } from '@/components/MediaViewer/MediaFixButton';
import { useMediaUtils } from '@/hooks/useMediaUtils';

interface MessageControlPanelProps {
  onRefresh: () => void;
  isRefreshing: boolean;
  messageCount?: number;
}

export const MessageControlPanel: React.FC<MessageControlPanelProps> = ({
  onRefresh,
  isRefreshing,
  messageCount = 0
}) => {
  const { isProcessing, processAllPendingMessages } = useMediaUtils();
  
  return (
    <div className="bg-muted/30 p-4 rounded-lg border">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="flex flex-col w-full sm:w-auto">
          <h2 className="font-semibold">Message Queue</h2>
          <p className="text-sm text-muted-foreground">
            {messageCount} {messageCount === 1 ? 'message' : 'messages'} in the queue
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
          <MediaFixButton 
            variant="outline" 
            size="sm" 
          />
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => processAllPendingMessages()}
            disabled={isRefreshing || isProcessing}
          >
            Process All Pending
          </Button>
          
          <ActionButtons 
            onRefresh={onRefresh}
            isRefreshing={isRefreshing}
            isProcessing={isProcessing}
          />
        </div>
      </div>
    </div>
  );
};
