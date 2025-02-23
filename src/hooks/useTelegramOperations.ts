
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import type { Message } from "@/types";

export const useTelegramOperations = () => {
  const [isProcessing, setIsProcessing] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const handleDelete = async (message: Message, deleteTelegram: boolean = true) => {
    try {
      setIsProcessing(prev => ({ ...prev, [message.id]: true }));
      
      // If part of a media group, get all related messages
      let messagesToDelete = [message];
      if (message.media_group_id) {
        const { data: groupMessages } = await supabase
          .from('messages')
          .select('*')
          .eq('media_group_id', message.media_group_id)
          .returns<Message[]>();
          
        if (groupMessages) {
          messagesToDelete = groupMessages;
        }
      }

      // Delete from Telegram if requested - do this first
      if (deleteTelegram) {
        const deletePromises = messagesToDelete.map(async (msg) => {
          if (msg.telegram_message_id && msg.chat_id) {
            const response = await supabase.functions.invoke('delete-telegram-message', {
              body: {
                message_id: msg.telegram_message_id,
                chat_id: msg.chat_id
              }
            });

            if (response.error) {
              console.error('Telegram deletion error:', response.error);
              throw new Error(`Failed to delete message ${msg.telegram_message_id} from Telegram: ${response.error.message}`);
            }
          }
        });

        await Promise.all(deletePromises);
      }

      // After successful Telegram deletion (or if not deleting from Telegram),
      // delete from database
      const deletePromises = messagesToDelete.map(async (msg) => {
        const { error: deleteError } = await supabase
          .from('messages')
          .delete()
          .match({ id: msg.id });

        if (deleteError) {
          console.error('Database deletion error:', deleteError);
          throw deleteError;
        }
      });

      await Promise.all(deletePromises);

      // Show success message
      toast({
        title: "Success",
        description: `${messagesToDelete.length > 1 ? 'Messages' : 'Message'} deleted successfully${
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
          body: {
            messageId: message.telegram_message_id,
            chatId: message.chat_id,
            caption: newCaption,
          },
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
        body: { 
          messageId: message.id,
          caption: newCaption
        }
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
