
import React from 'react';
import type { Message } from './types';
import { useMessageProcessing } from '../../hooks/useMessageProcessing';

interface MessageControlsProps {
  message: Message;
  onSuccess?: () => void;
}

export function MessageControls({ message, onSuccess }: MessageControlsProps) {
  const { handleReanalyze, isProcessing, errors } = useMessageProcessing();

  const isCurrentlyProcessing = isProcessing[message.id];
  const error = errors[message.id];
  const canRetry = message.processing_state === 'error' || 
    (message.processing_state === 'completed' && (!message.analyzed_content || !message.analyzed_content.product_code));
  const canSync = message.media_group_id && 
    message.processing_state === 'completed' && 
    !message.group_caption_synced;

  const handleRetry = async () => {
    await handleReanalyze(message);
    onSuccess?.();
  };

  return (
    <div className="flex flex-col space-y-2">
      {canRetry && (
        <button
          onClick={handleRetry}
          disabled={isCurrentlyProcessing}
          className={`px-3 py-1 text-sm rounded-md
            ${isCurrentlyProcessing 
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
              : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
        >
          {isCurrentlyProcessing ? 'Processing...' : 'Retry Analysis'}
        </button>
      )}
      {error && (
        <div className="text-sm text-red-600 mt-1">
          {error}
        </div>
      )}
    </div>
  );
}
