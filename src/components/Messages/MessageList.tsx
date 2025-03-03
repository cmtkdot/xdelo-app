
import React from 'react';
import { Message } from '@/types';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle, AlertCircle, Clock, RefreshCw } from 'lucide-react';
import { MediaGrid } from "@/components/MediaGrid";
import { toast } from 'sonner';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  onRetryProcessing: (messageId: string) => Promise<void>;
  onProcessAll: () => Promise<void>;
  processAllLoading?: boolean;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isLoading,
  onRetryProcessing,
  onProcessAll,
  processAllLoading = false
}) => {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-48">
        <Spinner size="lg" />
        <span className="ml-3">Loading messages...</span>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="text-center p-8">
        <h3 className="text-xl font-semibold mb-2">No messages found</h3>
        <p className="text-gray-500">There are no messages to display.</p>
      </div>
    );
  }

  // Count messages by processing state
  const pendingCount = messages.filter(msg => msg.processing_state === 'pending').length;
  const processingCount = messages.filter(msg => msg.processing_state === 'processing').length;
  const errorCount = messages.filter(msg => msg.processing_state === 'error').length;
  const completedCount = messages.filter(msg => msg.processing_state === 'completed').length;

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow mb-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Message Processing Status</h2>
          <Button 
            onClick={onProcessAll} 
            disabled={processAllLoading || (!pendingCount && !errorCount)}
            className="flex items-center"
          >
            {processAllLoading ? <Spinner size="sm" className="mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Process All
          </Button>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <StatusCard title="Pending" count={pendingCount} icon={<Clock className="text-yellow-500" />} />
          <StatusCard title="Processing" count={processingCount} icon={<ArrowRight className="text-blue-500" />} />
          <StatusCard title="Completed" count={completedCount} icon={<CheckCircle className="text-green-500" />} />
          <StatusCard title="Error" count={errorCount} icon={<AlertCircle className="text-red-500" />} />
        </div>
      </div>

      <div className="space-y-4">
        {messages.map((message) => (
          <Card key={message.id} className="overflow-hidden">
            <CardContent className="p-0">
              <div className="p-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="text-sm text-gray-500">
                      Message ID: {message.telegram_message_id} • 
                      Chat: {message.chat_title || message.chat_id}
                    </p>
                    {message.caption && (
                      <p className="font-medium">Caption: {message.caption}</p>
                    )}
                    {message.analyzed_content?.product_name && (
                      <p className="text-sm">
                        <span className="font-semibold">Product:</span> {message.analyzed_content.product_name}
                      </p>
                    )}
                    {message.analyzed_content?.vendor_uid && (
                      <p className="text-sm">
                        <span className="font-semibold">Vendor:</span> {message.analyzed_content.vendor_uid}
                      </p>
                    )}
                    {message.analyzed_content?.purchase_date && (
                      <p className="text-sm">
                        <span className="font-semibold">Date:</span> {message.analyzed_content.purchase_date}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center">
                    <ProcessingStatus status={message.processing_state} />
                    {(message.processing_state === 'error' || message.processing_state === 'pending') && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="ml-2"
                        onClick={() => {
                          toast.promise(onRetryProcessing(message.id), {
                            loading: 'Processing message...',
                            success: 'Message processed successfully',
                            error: 'Failed to process message'
                          });
                        }}
                      >
                        <RefreshCw className="w-4 h-4 mr-1" />
                        Analyze
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              {message.public_url && (
                <div className="h-48 bg-gray-100">
                  {message.mime_type?.startsWith('image/') ? (
                    <img 
                      src={message.public_url} 
                      alt="Message media" 
                      className="h-full w-full object-contain"
                    />
                  ) : message.mime_type?.startsWith('video/') ? (
                    <video 
                      src={message.public_url} 
                      controls 
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-gray-500">Media not supported</p>
                    </div>
                  )}
                </div>
              )}
              {message.error_message && (
                <div className="p-3 bg-red-50 text-red-800 text-sm">
                  <p><span className="font-semibold">Error:</span> {message.error_message}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

interface StatusCardProps {
  title: string;
  count: number;
  icon: React.ReactNode;
}

const StatusCard: React.FC<StatusCardProps> = ({ title, count, icon }) => (
  <div className="bg-gray-50 p-4 rounded-lg">
    <div className="flex justify-between items-center">
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-bold">{count}</p>
      </div>
      <div className="text-2xl">{icon}</div>
    </div>
  </div>
);

interface ProcessingStatusProps {
  status?: string;
}

const ProcessingStatus: React.FC<ProcessingStatusProps> = ({ status }) => {
  switch (status) {
    case 'completed':
      return <span className="flex items-center text-green-600"><CheckCircle className="w-4 h-4 mr-1" /> Completed</span>;
    case 'processing':
      return <span className="flex items-center text-blue-600"><Spinner size="sm" className="mr-1" /> Processing</span>;
    case 'error':
      return <span className="flex items-center text-red-600"><AlertCircle className="w-4 h-4 mr-1" /> Error</span>;
    case 'pending':
      return <span className="flex items-center text-yellow-600"><Clock className="w-4 h-4 mr-1" /> Pending</span>;
    default:
      return <span className="text-gray-600">Unknown</span>;
  }
};
