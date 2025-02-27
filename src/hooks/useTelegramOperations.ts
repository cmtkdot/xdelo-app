
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/useToast";
import { useQueryClient } from "@tanstack/react-query";
import type { Message } from "@/types";
import { logDeletion } from "@/lib/syncLogger";

export const useTelegramOperations = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const handleDelete = async (message: Message, deleteTelegram: boolean = false) => {
    try {
      setIsProcessing(true);
      
      // Find the caption message if this isn't one
      const messageToDelete = message.is_original_caption ? 
        message : 
        await supabase
          .from('messages')
          .select('*')
          .eq('media_group_id', message.media_group_id)
          .eq('is_original_caption', true)
          .single()
          .then(({ data }) => data as Message);
      
      if (!messageToDelete) {
        throw new Error('Could not find caption message to delete');
      }

      // Log deletion intent
      await logDeletion(messageToDelete.id, deleteTelegram ? 'both' : 'database', {
        telegram_message_id: messageToDelete.telegram_message_id,
        chat_id: messageToDelete.chat_id,
        media_group_id: messageToDelete.media_group_id,
        operation: 'deletion_started'
      });

      // If deleting from Telegram
      if (deleteTelegram && messageToDelete.telegram_message_id && messageToDelete.chat_id) {
        // First mark as being deleted from Telegram
        const { error: updateError } = await supabase
          .from('messages')
          .update({ deleted_from_telegram: true })
          .eq('id', messageToDelete.id);

        if (updateError) throw updateError;

        // Then attempt Telegram deletion
        const response = await supabase.functions.invoke('delete-telegram-message', {
          body: {
            message_id: messageToDelete.telegram_message_id,
            chat_id: messageToDelete.chat_id,
            media_group_id: messageToDelete.media_group_id
          }
        });

        if (response.error) throw response.error;
      }

      // Delete from database (will cascade to related media group messages)
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageToDelete.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Message${message.media_group_id ? ' group' : ''} deleted successfully${
          deleteTelegram ? ' from both Telegram and database' : ' from database'
        }`,
      });

      queryClient.invalidateQueries({ queryKey: ['media-groups'] });

    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "Error",
        description: `Failed to delete message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    handleDelete,
    isProcessing
  };
};
