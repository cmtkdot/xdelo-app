
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Message } from '@/types/MessagesTypes';
import { useToast } from '@/hooks/useToast';
import { logEvent, LogEventType } from '@/lib/logUtils';

export function useTelegramOperations() {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  // Helper function to log message operations
  const logMessageOperation = async (eventType: LogEventType, entityId: string, metadata: any = {}) => {
    await logEvent(eventType, entityId, metadata);
  };

  const handleDelete = useCallback(async (message: Message, deleteTelegram: boolean = false): Promise<void> => {
    try {
      setIsProcessing(true);
      
      // Log the operation
      await logMessageOperation(LogEventType.MESSAGE_DELETED, message.id, {
        delete_from_telegram: deleteTelegram,
        file_unique_id: message.file_unique_id,
        media_group_id: message.media_group_id
      });
      
      // Call the Edge Function to handle deletion
      const { data, error } = await supabase.functions.invoke('xdelo_delete_message', {
        body: { 
          messageId: message.id,
          deleteFromTelegram: deleteTelegram
        }
      });
      
      if (error) throw new Error(error.message);
      
      toast({
        title: 'Message Deleted',
        description: deleteTelegram 
          ? 'Message has been deleted from both database and Telegram.' 
          : 'Message has been marked as deleted in the database.',
      });
      
    } catch (error) {
      console.error('Error deleting message:', error);
      
      toast({
        title: 'Error',
        description: 'Failed to delete message. Please try again.',
        variant: 'destructive',
      });
      
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);

  const handleForward = useCallback(async (message: Message, chatId: number): Promise<void> => {
    try {
      setIsProcessing(true);
      
      // Log the operation
      await logMessageOperation(LogEventType.USER_ACTION, message.id, {
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
      
      toast({
        title: 'Error',
        description: 'Failed to forward message. Please try again.',
        variant: 'destructive',
      });
      
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);

  const handleReprocess = useCallback(async (messageId: string): Promise<void> => {
    try {
      setIsProcessing(true);
      
      // Log the operation
      await logMessageOperation(LogEventType.USER_ACTION, messageId, {
        action: 'manual_reprocess'
      });
      
      // Call the Edge Function to handle reprocessing
      const { data, error } = await supabase.functions.invoke('xdelo_reprocess_message', {
        body: { 
          messageId,
          force: true
        }
      });
      
      if (error) throw new Error(error.message);
      
      toast({
        title: 'Message Reprocessed',
        description: 'Message has been successfully reprocessed.',
      });
      
    } catch (error) {
      console.error('Error reprocessing message:', error);
      
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
    handleDelete,
    handleForward,
    handleReprocess,
    isProcessing
  };
}
