import { useToast } from '@/hooks/useToast';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { LogEventType } from '@/types/api/LogEventType';
import { Message } from '@/types/entities/Message';
import { useCallback, useState } from 'react';

// Create a logger specific to telegram operations
const logger = createLogger('telegram-operations');

export const useTelegramOperations = () => {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Function to delete a message from Telegram only
  const deleteTelegramMessage = async (messageId: string, chatId: string, mediaGroupId?: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('delete-telegram-message', {
        body: { message_id: messageId, chat_id: chatId, media_group_id: mediaGroupId },
      });

      if (error) throw error;
      return { success: true, data };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error deleting message from Telegram', errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  // Function to delete a message from the database only
  const deleteFromDatabase = async (messageUuid: string) => {
    try {
      const { error } = await supabase.from('messages').delete().eq('id', messageUuid);

      if (error) throw error;
      return { success: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error deleting message from database', errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  // Function to refresh the message cache
  const refreshCache = () => {
    // This would typically call a function to refresh the message list
    // For now, we'll just use window.location.reload() as a fallback
    window.location.reload();
  };

  // Function to delete a message with two possible flows: DB only or DB + Telegram
  const deleteMessage = async (message: Message, deleteFromTelegram = false) => {
    setIsDeleting(true);

    try {
      // Destructure needed message properties
      const { id: messageUuid, telegram_message_id: telegramMessageId, chat_id: chatId, media_group_id: mediaGroupId } = message;

      // If we're not deleting from Telegram, just delete from the database
      if (!deleteFromTelegram) {
        const result = await deleteFromDatabase(messageUuid);

        if (!result.success) {
          toast({
            title: 'Error',
            description: result.error || 'Failed to delete message',
            variant: 'destructive',
          });
          return false;
        }

        toast({
          title: 'Success',
          description: 'Message deleted from database',
        });

        refreshCache();
        return true;
      }

      // If we're deleting from Telegram, we need to:
      // 1. Archive the message(s) using our new function
      // 2. Delete from Telegram
      // 3. Delete from database

      // Step 1: Archive the message(s)
      // Using the custom RPC function we created
      // Note: This might need to be adjusted based on how custom functions are called in your setup
      try {
        const response = await fetch(`${supabase.supabaseUrl}/rest/v1/rpc/x_archive_message_for_deletion`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabase.supabaseKey,
            'Authorization': `Bearer ${supabase.supabaseKey}`
          },
          body: JSON.stringify({ p_message_id: messageUuid })
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Failed to archive message: ${error}`);
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        toast({
          title: 'Error',
          description: `Failed to archive message: ${errorMessage}`,
          variant: 'destructive',
        });
        return false;
      }

      // Step 2: Delete from Telegram
      const telegramResult = await deleteTelegramMessage(
        telegramMessageId.toString(),
        chatId.toString(),
        mediaGroupId
      );

      if (!telegramResult.success) {
        toast({
          title: 'Error',
          description: `Failed to delete from Telegram: ${telegramResult.error}`,
          variant: 'destructive',
        });
        return false;
      }

      // Step 3: Delete from database
      const dbResult = await deleteFromDatabase(messageUuid);

      if (!dbResult.success) {
        toast({
          title: 'Warning',
          description: `Message deleted from Telegram but failed to delete from database: ${dbResult.error}`,
          variant: 'destructive',
        });
        return false;
      }

      toast({
        title: 'Success',
        description: 'Message deleted from Telegram and database',
      });

      refreshCache();
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error in deleteMessage:', errorMessage);
      toast({
        title: 'Error',
        description: errorMessage || 'An error occurred while deleting the message',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsDeleting(false);
    }
  };

  const handleForward = useCallback(async (message: Message, chatId: number): Promise<void> => {
    try {
      setIsProcessing(true);

      // Log the operation with consolidated logging
      await logger.logEvent(LogEventType.USER_ACTION, message.id, {
        action: 'forward',
        target_chat_id: chatId,
        file_unique_id: message.file_unique_id
      });

      // Call the Edge Function to handle forwarding
      const { data, error } = await supabase.functions.invoke('xdelo_forward_message', {
        body: {
          messageId: message.id,
          targetChatId: chatId
        }
      });

      if (error) throw new Error(error.message);

      toast({
        title: 'Message Forwarded',
        description: `Message has been forwarded to chat ID: ${chatId}`,
      });

    } catch (error) {
      console.error('Error forwarding message:', error);

      // Log the error with consolidated logging
      await logger.logEvent(LogEventType.SYSTEM_ERROR, message.id, {
        action: 'forward',
        target_chat_id: chatId,
        error: error instanceof Error ? error.message : String(error)
      });

      toast({
        title: 'Error',
        description: 'Failed to forward message. Please try again.',
        variant: 'destructive',
      });

    } finally {
      setIsProcessing(false);
    }
  }, [toast]);

  const handleReprocess = useCallback(async (message: Message): Promise<void> => {
    try {
      setIsProcessing(true);

      // Log the operation with consolidated logging
      await logger.logEvent(LogEventType.MESSAGE_REPROCESSED, message.id, {
        action: 'manual_reprocess'
      });

      // Call the Edge Function
      const { data, error } = await supabase.functions.invoke('xdelo_reprocess_message', {
        body: {
          messageId: message.id,
          force: true
        }
      });

      if (error) throw new Error(error.message);

      toast({
        title: 'Reprocessing Started',
        description: 'The message has been queued for reprocessing.',
      });

    } catch (error) {
      console.error('Error reprocessing message:', error);

      // Log the error with consolidated logging
      await logger.logEvent(LogEventType.SYSTEM_ERROR, message.id, {
        action: 'reprocess',
        error: error instanceof Error ? error.message : String(error)
      });

      toast({
        title: 'Error',
        description: 'Failed to reprocess message. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);

  return {
    deleteMessage,
    handleForward,
    handleReprocess,
    isDeleting,
    isProcessing,
  };
};
