
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import type { Message } from '@/types';
import { formatDate } from '@/lib/utils';
import { useMediaOperations } from '@/hooks/useMediaOperations';
import { logMessageOperation } from '@/lib/syncLogger';
import { LogEventType } from '@/types/api/LogEventType';

interface MessageCardProps {
  message: Message;
  onRetryProcessing: (messageId: string) => Promise<void>;
  processAllLoading?: boolean;
}

export const MessageCard: React.FC<MessageCardProps> = ({ 
  message, 
  onRetryProcessing,
  processAllLoading = false
}) => {
  const { 
    isProcessing,
    repairMediaBatch 
  } = useMediaOperations();
  
  const { 
    id,
    caption,
    analyzed_content,
    processing_state,
    created_at,
    error_message
  } = message;

  const handleRetry = async () => {
    if (isProcessing) return;
    
    try {
      // Log the retry attempt
      await logMessageOperation(LogEventType.USER_ACTION, id, {
        action: 'retry_processing',
        previous_state: processing_state,
        error_message
      });
      
      // Try the provided retry function first
      await onRetryProcessing(id);
    } catch (error) {
      console.error('Error in primary retry, attempting repair:', error);
      
      // Log the fallback to repair
      await logMessageOperation(LogEventType.USER_ACTION, id, {
        action: 'fallback_to_repair',
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Fall back to repair if the retry function fails
      await repairMediaBatch([id]);
    }
  };

  const isError = message.processing_state === 'error';
  const productDetails = analyzed_content ? (analyzed_content as any)?.product_name : null;
  const isLoading = processAllLoading || isProcessing;

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            {productDetails && (
              <div className="text-sm font-medium">{productDetails}</div>
            )}
            {caption && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {caption.substring(0, 100)}{caption.length > 100 ? '...' : ''}
              </p>
            )}
            <div className="text-xs text-gray-400 dark:text-gray-500">
              Created: {formatDate(new Date(created_at || ''))}
            </div>
            {error_message && (
              <div className="text-xs text-red-500 dark:text-red-400">
                Error: {error_message}
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {isError && (
              <Button 
                onClick={handleRetry}
                disabled={isLoading}
                variant="outline"
                size="sm"
                className="h-8 px-2"
              >
                {isLoading ? (
                  <Spinner size="sm" className="mr-1" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-1" />
                )}
                Retry
              </Button>
            )}
            <Badge variant="secondary">{processing_state}</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
