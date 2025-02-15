import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Message } from "@/types";
import { useQueryClient } from "@tanstack/react-query";

export const useTelegramOperations = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleDelete = async (message: Message, deleteTelegram: boolean = true) => {
    try {
      setIsProcessing(true);
      
      if (deleteTelegram && message.telegram_message_id && message.chat_id) {
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

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['messages'] });

    } catch (error: any) {
      console.error('Delete error:', error);
      toast({
        title: "Error",
        description: `Failed to delete message: ${error.message}`,
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
      // Update caption in Telegram
      const { data: telegramResponse, error: telegramError } = await supabase
        .functions.invoke('update-telegram-caption', {
          body: {
            messageId: message.telegram_message_id,
            chatId: message.chat_id,
            caption: newCaption,
          },
        });

      if (telegramError) throw telegramError;

      // Update caption in database
      const { error: dbError } = await supabase
        .from('messages')
        .update({ 
          caption: newCaption,
          updated_at: new Date().toISOString(),
          processing_state: 'pending' // Set to pending to trigger reanalysis
        })
        .eq('id', message.id);

      if (dbError) throw dbError;

      // Trigger reanalysis
      await supabase.functions.invoke('parse-caption-with-ai', {
        body: { 
          messageId: message.id,
          caption: newCaption
        }
      });

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['messages'] });

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
