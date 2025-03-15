
import { useState, useCallback } from 'react';
import { Message } from '@/types/entities/Message';
import { useTelegramOperations } from './useTelegramOperations';
import { useMediaOperations } from './useMediaOperations';

export function useMessageViewHandlers() {
  // Change from Record<string, boolean> to Record<string, Message>
  const [selectedMessages, setSelectedMessages] = useState<Record<string, Message>>({});
  const { handleDelete, isProcessing } = useTelegramOperations();
  const { 
    fixContentDispositionForMessage,
    reuploadMediaFromTelegram,
    processingMessageIds
  } = useMediaOperations();

  // Update to only use the Message parameter
  const handleToggleSelect = useCallback((message: Message) => {
    setSelectedMessages(prev => {
      // If already selected, remove it; otherwise add it
      if (prev[message.id]) {
        const newSelected = {...prev};
        delete newSelected[message.id];
        return newSelected;
      } else {
        return {
          ...prev,
          [message.id]: message
        };
      }
    });
  }, []);

  // Clear all selections
  const clearSelection = useCallback(() => {
    setSelectedMessages({});
  }, []);

  // Get all selected message IDs
  const getSelectedMessageIds = useCallback(() => {
    return Object.keys(selectedMessages);
  }, [selectedMessages]);

  return {
    selectedMessages,
    handleToggleSelect,
    clearSelection,
    getSelectedMessageIds,
    deleteMessage: handleDelete, // Map to the correct property
    fixContentDispositionForMessage,
    reuploadMediaFromTelegram,
    isProcessing,
    processingMessageIds
  };
}
