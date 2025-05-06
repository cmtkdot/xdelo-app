import { Message } from '@/types';
import { useCallback, useState } from 'react';
import { useTelegramOperations } from './useTelegramOperations';

export function useMessageViewHandlers() {
  // Store the actual message objects rather than just booleans
  const [selectedMessages, setSelectedMessages] = useState<Record<string, Message>>({});
  const { deleteMessage, isDeleting } = useTelegramOperations();

  // Toggle message selection with proper typing
  const handleToggleSelect = useCallback((message: Message) => {
    setSelectedMessages(prev => {
      // If already selected, remove it; otherwise add it
      if (prev[message.id]) {
        const newSelected = { ...prev };
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

  // Get array of selected messages
  const getSelectedMessagesArray = useCallback(() => {
    return Object.values(selectedMessages);
  }, [selectedMessages]);

  return {
    selectedMessages,
    handleToggleSelect,
    clearSelection,
    getSelectedMessageIds,
    getSelectedMessagesArray,
    deleteMessage,
    isDeleting
  };
}
