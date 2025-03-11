
import { Spinner } from '@/components/ui/spinner';
import MessageCard from './MessageCard';
import { Message } from '@/types/MessagesTypes';

export interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  onRetryProcessing: (messageId: string) => Promise<void>;
  onFixMedia: (messageId: string, storagePath: string) => Promise<void>;
  processAllLoading?: boolean;
}

const MessageList: React.FC<MessageListProps> = ({ 
  messages, 
  isLoading, 
  onRetryProcessing, 
  onFixMedia,
  processAllLoading 
}) => {
  if (isLoading || processAllLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Spinner size="lg" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No messages found
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <MessageCard 
          key={message.id} 
          message={message} 
          onRetryProcessing={onRetryProcessing}
          onFixMedia={onFixMedia}
        />
      ))}
    </div>
  );
};

export default MessageList;
