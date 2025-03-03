
import React from 'react';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { Message } from '@/types';
import { RefreshCw, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import MediaGrid from '../MediaGrid';

export interface MessageListProps {
  messages: Message[];
  onRefresh: () => Promise<void>;
  onReanalyze: (messageId: string) => Promise<void>;
}

export const MessageList: React.FC<MessageListProps> = ({ messages, onRefresh, onReanalyze }) => {
  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  if (!messages || messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 space-y-4">
        <p className="text-gray-500">No messages found</p>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
          {refreshing ? <Spinner size="sm" className="mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Messages ({messages.length})</h2>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing} size="sm">
          {refreshing ? <Spinner size="sm" className="mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Refresh
        </Button>
      </div>

      <div className="space-y-6">
        {messages.map((message) => (
          <div 
            key={message.id} 
            className={cn(
              "p-4 border rounded-lg shadow-sm",
              message.processing_state === 'error' && "border-red-300 bg-red-50 dark:bg-red-950 dark:border-red-800",
              message.processing_state === 'pending' && "border-yellow-300 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800",
              message.processing_state === 'processing' && "border-blue-300 bg-blue-50 dark:bg-blue-950 dark:border-blue-800",
              message.processing_state === 'completed' && "border-green-300 bg-green-50 dark:bg-green-950 dark:border-green-800"
            )}
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center">
                <span className="text-sm font-medium">
                  {message.processing_state === 'error' && "Error"}
                  {message.processing_state === 'pending' && "Pending"}
                  {message.processing_state === 'processing' && "Processing"}
                  {message.processing_state === 'completed' && "Completed"}
                  {!message.processing_state && "Unprocessed"}
                </span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => onReanalyze(message.id)}
                  className="ml-2"
                >
                  <RotateCw className="w-4 h-4 mr-1" />
                  Reanalyze
                </Button>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{message.caption}</p>
            
            {message.error_message && (
              <div className="mb-4 p-2 bg-red-100 dark:bg-red-900 rounded text-sm">
                <p className="font-semibold">Error:</p>
                <p>{message.error_message}</p>
              </div>
            )}
            
            {message.analyzed_content && (
              <div className="space-y-1 mb-4 text-sm">
                <h3 className="font-semibold">Analyzed Content:</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="font-medium">Product:</span> {message.analyzed_content.product_name}
                  </div>
                  <div>
                    <span className="font-medium">Code:</span> {message.analyzed_content.product_code}
                  </div>
                  <div>
                    <span className="font-medium">Vendor:</span> {message.analyzed_content.vendor_uid}
                  </div>
                  <div>
                    <span className="font-medium">Date:</span> {message.analyzed_content.purchase_date}
                  </div>
                  {message.analyzed_content.quantity && (
                    <div>
                      <span className="font-medium">Quantity:</span> {message.analyzed_content.quantity}
                    </div>
                  )}
                  {message.analyzed_content.notes && (
                    <div className="col-span-2">
                      <span className="font-medium">Notes:</span> {message.analyzed_content.notes}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {message.public_url && (
              <div className="mt-4">
                <MediaGrid media={[{
                  id: message.id,
                  public_url: message.public_url,
                  mime_type: message.mime_type,
                  created_at: message.created_at || '',
                  analyzed_content: message.analyzed_content
                }]} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
