
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/useToast";
import { useQueryClient } from "@tanstack/react-query";
import type { Message } from "@/types";

export const useTelegramOperations = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const handleDelete = async (message: Message, deleteTelegram: boolean = true) => {
    try {
      setIsProcessing(true);
      
      if (deleteTelegram && message.telegram_message_id && message.chat_id) {
        // First mark the message as being deleted from Telegram
        const { error: updateError } = await supabase
          .from('messages')
          .update({
            deleted_from_telegram: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', message.id);

        if (updateError) throw updateError;

        // Then attempt to delete from Telegram
        const response = await supabase.functions.invoke('delete-telegram-message', {
          body: {
            message_id: message.telegram_message_id,
            chat_id: message.chat_id,
            media_group_id: message.media_group_id
          }
        });

        if (response.error) throw response.error;
      }

      // Delete from database
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', message.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Message deleted successfully${deleteTelegram ? ' from both Telegram and database' : ' from database'}`,
      });

      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['media-groups'] });

    } catch (error: unknown) {
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

  const handleSave = async (message: Message, newCaption: string) => {
    setIsProcessing(true);
    try {
      const { data: telegramResponse, error: telegramError } = await supabase
        .functions.invoke('update-telegram-caption', {
          body: {
            messageId: message.telegram_message_id,
            chatId: message.chat_id,
            caption: newCaption,
          },
        });

      if (telegramError) throw telegramError;

      const { error: dbError } = await supabase
        .from('messages')
        .update({ 
          caption: newCaption,
          updated_at: new Date().toISOString(),
          processing_state: 'pending'
        })
        .eq('id', message.id);

      if (dbError) throw dbError;

      await supabase.functions.invoke('parse-caption-with-ai', {
        body: { 
          messageId: message.id,
          caption: newCaption
        }
      });

      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['media-groups'] });

    } catch (error) {
      console.error('Error updating caption:', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    handleDelete,
    handleSave,
    isProcessing
  };
};
