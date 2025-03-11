
import React, { useState } from 'react';
import useRealTimeMessages from '@/hooks/useRealTimeMessages';
import MessageList from './MessageList';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/useToast';

const MessageListContainer: React.FC = () => {
  const { toast } = useToast();
  const { 
    messages, 
    isLoading, 
    processAllLoading,
    retryProcessing,
    refreshMessages
  } = useRealTimeMessages({});
  
  const [isFixingMedia, setIsFixingMedia] = useState<Record<string, boolean>>({});

  const handleRetryProcessing = async (messageId: string) => {
    await retryProcessing(messageId);
    refreshMessages();
  };

  const handleFixMedia = async (messageId: string, storagePath: string) => {
    if (!storagePath) {
      toast({
        title: 'Error',
        description: 'Missing storage path for media',
        variant: 'destructive'
      });
      return;
    }
    
    setIsFixingMedia(prev => ({ ...prev, [messageId]: true }));
    
    try {
      const { error } = await supabase.functions.invoke('media-management', {
        body: { 
          action: 'repair_content_disposition', 
          storagePath,
          messageId
        }
      });
      
      if (error) throw error;
      
      toast({
        title: 'Success',
        description: 'Media content type fixed successfully'
      });
      
      // Refresh the messages to show updated public URLs
      await refreshMessages();
    } catch (error) {
      console.error('Error fixing media content type:', error);
      toast({
        title: 'Error',
        description: 'Failed to fix media content type',
        variant: 'destructive'
      });
    } finally {
      setIsFixingMedia(prev => ({ ...prev, [messageId]: false }));
    }
  };

  return (
    <div>
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
