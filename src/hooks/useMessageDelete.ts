import { useState } from 'react';
import { Message } from '@/types/entities/Message';
import { useTelegramOperations } from './useTelegramOperations';
import { useToast } from './useToast';

/**
 * Hook for managing message deletion with a unified interface
 * Provides state and handlers for the delete dialog and deletion process
 */
export const useMessageDelete = () => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<Message | null>(null);
  const { deleteMessage, isDeleting } = useTelegramOperations();
  const { toast } = useToast();

  /**
   * Opens the delete dialog for a specific message
   */
  const handleDeleteClick = (message: Message) => {
    setMessageToDelete(message);
    setIsDeleteDialogOpen(true);
  };

  /**
   * Handles the confirmation of message deletion
   * @param deleteTelegram Whether to delete from Telegram as well as the database
   */
  const handleDeleteConfirm = async (deleteTelegram: boolean) => {
    if (!messageToDelete) {
      toast({
        title: 'Error',
        description: 'No message selected for deletion',
        variant: 'destructive',
      });
      return;
    }

    try {
      await deleteMessage(messageToDelete, deleteTelegram);
      setIsDeleteDialogOpen(false);
      setMessageToDelete(null);
    } catch (error) {
      console.error('Error in handleDeleteConfirm:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred during deletion',
        variant: 'destructive',
      });
    }
  };

  /**
   * Closes the delete dialog without taking action
   */
  const cancelDelete = () => {
    setIsDeleteDialogOpen(false);
    setMessageToDelete(null);
  };

  return {
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    messageToDelete,
    isDeleting,
    handleDeleteClick,
    handleDeleteConfirm,
    cancelDelete,
  };
};

export default useMessageDelete;
