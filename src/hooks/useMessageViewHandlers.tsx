
import { useState, useCallback } from 'react';
import { Message } from '@/types/entities/Message';
import { useTelegramOperations } from './useTelegramOperations';
import { useMediaOperations } from './useMediaOperations';

export function useMessageViewHandlers() {
  const [selectedMessages, setSelectedMessages] = useState<Record<string, boolean>>({});
  const { handleDelete, isProcessing } = useTelegramOperations();
  const { 
    fixContentDispositionForMessage,
    reuploadMediaFromTelegram,
    processingMessageIds
  } = useMediaOperations();

  // Handle selecting/deselecting messages
  const handleToggleSelect = useCallback((message: Message, selected: boolean) => {
    setSelectedMessages(prev => ({
      ...prev,
      [message.id]: selected
    }));
  }, []);

  // Clear all selections
  const clearSelection = useCallback(() => {
    setSelectedMessages({});
  }, []);

  // Get all selected message IDs
  const getSelectedMessageIds = useCallback(() => {
    return Object.entries(selectedMessages)
      .filter(([_, selected]) => selected)
      .map(([id]) => id);
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
