import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { Message } from '@/types';
import { formatDate } from '@/lib/utils';

interface MessageCardProps {
  message: Message;
  onRetryProcessing: (messageId: string) => Promise<void>;
  processAllLoading: boolean;
}

export const MessageCard: React.FC<MessageCardProps> = ({ 
  message, 
  onRetryProcessing,
  processAllLoading
}) => {
  const { 
    id,
    caption,
    analyzed_content,
    processing_state,
    created_at,
    error_message,
    retry_count
  } = message;

  const handleRetry = async () => {
    await onRetryProcessing(id);
  };

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            {analyzed_content?.product_name && (
              <div className="text-sm font-medium">{analyzed_content.product_name}</div>
            )}
            {caption && (
              <p className="text-sm text-gray-500 dark:text-gray-400">{caption.substring(0, 100)}{caption.length > 100 ? '...' : ''}</p>
            )}
            <div className="text-xs text-gray-400 dark:text-gray-500">
              Created: {formatDate(new Date(created_at || ''))}
            </div>
            {error_message && (
              <div className="text-xs text-red-500 dark:text-red-400">
                Error: {error_message}
              </div>
            )}
            {retry_count && retry_count > 0 && (
              <div className="text-xs text-orange-500 dark:text-orange-400">
                Retried: {retry_count} times
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {processing_state === 'error' && (
              <button 
                onClick={handleRetry}
                disabled={processAllLoading}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 px-4 py-2"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </button>
            )}
            <Badge variant="secondary">{processing_state}</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
