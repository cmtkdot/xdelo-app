
import React from 'react';
import { Message } from '@/types';
import { useMessageQueue } from '@/hooks/useMessageQueue';

interface MessageControlsProps {
  message: Message;
  onSuccess?: () => void;
}

export function MessageControls({ message, onSuccess }: MessageControlsProps) {
  const { processMessageById, isProcessing } = useMessageQueue();

  const canRetry = message.processing_state === 'error' || 
    (message.processing_state === 'completed' && (!message.analyzed_content || !message.analyzed_content.product_code));
  
  const canSync = message.media_group_id && 
    message.processing_state === 'completed' && 
    !message.group_caption_synced;

  const handleRetry = async () => {
    try {
      await processMessageById(message.id);
      onSuccess?.();
    } catch (error) {
      console.error('Error retrying message processing:', error);
    }
  };

  return (
    <div className="flex flex-col space-y-2">
      {canRetry && (
        <button
          onClick={handleRetry}
          disabled={isProcessing}
          className={`px-3 py-1 text-sm rounded-md
            ${isProcessing 
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
              : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
        >
          {isProcessing ? 'Processing...' : 'Retry Analysis'}
        </button>
      )}
    </div>
  );
}
