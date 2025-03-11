
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import MessageList from './MessageList';
import useRealTimeMessages, { ProcessingState } from '@/hooks/useRealTimeMessages';
import { useMediaFixer } from '@/hooks/useMediaFixer';

const MessageListContainer = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'processing' | 'completed' | 'error'>('pending');
  
  const processingStates: Record<string, ProcessingState[]> = {
    pending: [ProcessingState.Pending, ProcessingState.Initialized],
    processing: [ProcessingState.Processing],
    completed: [ProcessingState.Completed],
    error: [ProcessingState.Error]
  };
  
  const { 
    messages, 
    isLoading, 
    processAllLoading, 
    retryProcessing, 
    processAllPending 
  } = useRealTimeMessages({
    processingStates: processingStates[activeTab],
    limit: 50
  });

  const { fixMediaContentType, isRepairing } = useMediaFixer();

  const handleTabChange = (tab: 'pending' | 'processing' | 'completed' | 'error') => {
    setActiveTab(tab);
  };

  const handleRetryProcessing = async (messageId: string) => {
    await retryProcessing(messageId);
  };

  const handleFixMedia = async (messageId: string, storagePath: string) => {
    if (!storagePath) {
      console.error('No storage path provided for message', messageId);
      return;
    }
    
    await fixMediaContentType(storagePath);
  };

  useEffect(() => {
    // Auto refresh the list when tab changes
    const interval = setInterval(() => {
      if (activeTab === 'processing') {
        processAllPending();
      }
    }, 30000); // 30 seconds
    
    return () => clearInterval(interval);
  }, [activeTab, processAllPending]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button 
          variant={activeTab === 'pending' ? 'default' : 'outline'} 
          onClick={() => handleTabChange('pending')}
        >
          Pending
        </Button>
        <Button 
          variant={activeTab === 'processing' ? 'default' : 'outline'} 
          onClick={() => handleTabChange('processing')}
        >
          Processing
        </Button>
        <Button 
          variant={activeTab === 'completed' ? 'default' : 'outline'} 
          onClick={() => handleTabChange('completed')}
        >
          Completed
        </Button>
        <Button 
          variant={activeTab === 'error' ? 'default' : 'outline'} 
          onClick={() => handleTabChange('error')}
        >
          Errors
        </Button>
        
        {activeTab === 'pending' && (
          <Button 
            variant="outline" 
            onClick={processAllPending}
            disabled={processAllLoading || messages.length === 0}
            className="ml-auto"
          >
            {processAllLoading ? <Spinner size="sm" /> : 'Process All'}
          </Button>
        )}
      </div>
      
      <MessageList 
        messages={messages} 
        isLoading={isLoading} 
        onRetryProcessing={handleRetryProcessing}
        onFixMedia={handleFixMedia}
        processAllLoading={processAllLoading}
      />
    </div>
  );
};

export default MessageListContainer;
