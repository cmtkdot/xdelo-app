
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/useToast";
import { useQueryClient } from "@tanstack/react-query";
import type { Message } from "@/types";

export const useTelegramOperations = () => {
  const [isProcessing, setIsProcessing] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const handleDelete = async (message: Message, deleteTelegram: boolean = true) => {
    try {
      setIsProcessing(prev => ({ ...prev, [message.id]: true }));
      
      // If deleting from Telegram is requested, do this first
      if (deleteTelegram) {
        if (message.telegram_message_id && message.chat_id) {
          const { error: telegramError } = await supabase.functions.invoke('delete-telegram-message', {
            body: JSON.stringify({
              message_id: Number(message.telegram_message_id),
              chat_id: Number(message.chat_id),
              media_group_id: message.media_group_id || null
            })
          });

          if (telegramError) {
            console.error('Telegram deletion error:', telegramError);
            throw new Error(`Failed to delete message from Telegram: ${telegramError.message}`);
          }
        }
      }

      // Delete from database - the trigger will handle logging
      const { error: deleteError } = await supabase
        .from('messages')
        .delete()
        .eq('id', message.id);

      if (deleteError) {
        console.error('Database deletion error:', deleteError);
        throw deleteError;
      }

      // Show success message
      toast({
        title: "Success",
        description: `Message deleted successfully${
          deleteTelegram ? ' from both Telegram and database' : ' from database'
        }`,
      });

      // Refresh queries
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['media-groups'] });

    } catch (error: unknown) {
      console.error('Delete error:', error);
      toast({
        title: "Error",
        description: `Failed to delete message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(prev => ({ ...prev, [message.id]: false }));
    }
  };

  const handleSave = async (message: Message, newCaption: string) => {
    setIsProcessing(prev => ({ ...prev, [message.id]: true }));
    try {
      // Update in Telegram
      const { data: telegramResponse, error: telegramError } = await supabase
        .functions.invoke('update-telegram-caption', {
          body: JSON.stringify({
            messageId: message.telegram_message_id,
            chatId: message.chat_id,
            caption: newCaption,
          }),
        });

      if (telegramError) throw telegramError;

      // Update in database
      const { error: dbError } = await supabase
        .from('messages')
        .update({ 
          caption: newCaption,
          updated_at: new Date().toISOString(),
          processing_state: 'pending' as const
        })
        .eq('id', message.id);

      if (dbError) throw dbError;

      // Trigger reanalysis
      await supabase.functions.invoke('parse-caption-with-ai', {
        body: JSON.stringify({ 
          messageId: message.id,
          caption: newCaption
        })
      });

      queryClient.invalidateQueries({ queryKey: ['messages'] });

    } catch (error) {
      console.error('Error updating caption:', error);
      toast({
        title: "Error",
        description: `Failed to update caption: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(prev => ({ ...prev, [message.id]: false }));
    }
  };

  return {
    handleDelete,
    handleSave,
    isProcessing
  };
};
