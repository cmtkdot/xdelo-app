
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
      let messageToDelete: Message | null = null;
      
      if (message.caption) {
        // This message has a caption, use it directly
        messageToDelete = message;
      } else if (message.media_group_id) {
        // Try to find a caption message in the same media group
        const { data: captionMessage } = await supabase
          .from('messages')
          .select('*')
          .eq('media_group_id', message.media_group_id)
          .not('caption', 'is', null)
          .maybeSingle();
        
        if (captionMessage) {
          messageToDelete = captionMessage as Message;
        } else {
          // No caption found in the group, use the original message as fallback
          messageToDelete = message;
          
          // Log this special case
          console.log('No caption message found in media group, using original message for deletion');
        }
      } else {
        // Single message without media group
        messageToDelete = message;
      }
      
      if (!messageToDelete) {
        throw new Error('Could not find message to delete');
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

        try {
          // Attempt Telegram deletion
          const response = await supabase.functions.invoke('delete-telegram-message', {
            body: {
              message_id: messageToDelete.telegram_message_id,
              chat_id: messageToDelete.chat_id,
              media_group_id: messageToDelete.media_group_id
            }
          });

          if (response.error) throw response.error;
        } catch (telegramError) {
          console.error('Telegram deletion error:', telegramError);
          
          // If we fail to delete from Telegram but have a media group, try using another message from the group
          if (messageToDelete.media_group_id) {
            try {
              console.log('Attempting alternative message deletion strategy for media group');
              
              // Get another message from the same group that isn't the one we just tried
              const { data: alternateMessages } = await supabase
                .from('messages')
                .select('*')
                .eq('media_group_id', messageToDelete.media_group_id)
                .neq('id', messageToDelete.id)
                .limit(1);
              
              if (alternateMessages && alternateMessages.length > 0) {
                const alternateMessage = alternateMessages[0] as Message;
                
                // Try deleting with this other message
                const retryResponse = await supabase.functions.invoke('delete-telegram-message', {
                  body: {
                    message_id: alternateMessage.telegram_message_id,
                    chat_id: alternateMessage.chat_id,
                    media_group_id: alternateMessage.media_group_id
                  }
                });
                
                if (retryResponse.error) {
                  throw new Error(`Failed retry with alternate message: ${retryResponse.error}`);
                }
                
                console.log('Successfully deleted using alternative message in group');
              } else {
                throw new Error('No alternative messages found in media group for retry');
              }
            } catch (retryError) {
              console.error('Alternate deletion strategy failed:', retryError);
              // Continue with database deletion even if Telegram deletion failed
              toast({
                title: "Warning",
                description: `Could not delete from Telegram, but will proceed with database deletion. ${retryError instanceof Error ? retryError.message : 'Unknown error'}`,
                variant: "warning",
              });
            }
          } else {
            // No media group to try alternatives, just warn and continue
            toast({
              title: "Warning",
              description: `Could not delete from Telegram, but will proceed with database deletion. ${telegramError instanceof Error ? telegramError.message : 'Unknown error'}`,
              variant: "warning",
            });
          }
        }
      }

      // Delete from database (will cascade to related media group messages)
      // For media groups without caption, we'll delete all messages in the group
      if (message.media_group_id && !messageToDelete.caption) {
        // Special handling for media groups without caption - delete all messages in group
        const { error } = await supabase
          .from('messages')
          .delete()
          .eq('media_group_id', message.media_group_id);
        
        if (error) throw error;
      } else {
        // Standard deletion by message ID (will cascade via foreign key constraints)
        const { error } = await supabase
          .from('messages')
          .delete()
          .eq('id', messageToDelete.id);
        
        if (error) throw error;
      }

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
