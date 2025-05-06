import { useToast } from "@/hooks/useToast";
import { supabase } from "@/integrations/supabase/client";
import { createLogger } from "@/lib/logger";
import { LogEventType } from "@/types/api/LogEventType";
import { Message } from "@/types/entities/Message";
import { useCallback, useState } from "react";

// Create a logger specific to telegram operations
const logger = createLogger("telegram-operations");

// Custom type for RPC function names to bypass TypeScript checking
// Using unknown casts instead of RPCFunctionName to avoid linter errors
type RPCFunctionName = string;

export const useTelegramOperations = () => {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Function to delete a message from Telegram only
  const deleteTelegramMessage = async (
    messageId: number,
    chatId: number,
    mediaGroupId?: string
  ) => {
    try {
      const { data, error } = await supabase.functions.invoke(
        "delete-telegram-message",
        {
          body: {
            message_id: messageId,
            chat_id: chatId,
            media_group_id: mediaGroupId,
          },
        }
      );

      if (error) throw error;
      return { success: true, data };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Error deleting message from Telegram", errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  // Function to update caption in Telegram and database
  const updateCaption = async (
    message: Message,
    newCaption: string,
    updateMediaGroup = true
  ): Promise<boolean> => {
    try {
      setIsProcessing(true);

      if (!message.id) {
        throw new Error("Message ID is missing");
      }

      // Log the operation start
      await logger.logEvent(LogEventType.MESSAGE_UPDATED, message.id, {
        action: "update_started",
        old_caption: message.caption,
        new_caption: newCaption,
      });

      // Call the update-telegram-caption edge function
      const { data, error } = await supabase.functions.invoke(
        "update-telegram-caption",
        {
          body: {
            messageId: message.id,
            newCaption: newCaption,
            updateMediaGroup: updateMediaGroup,
          },
        }
      );

      if (error) {
        throw new Error(`Failed to update caption: ${error.message}`);
      }

      // Log success
      await logger.logEvent(LogEventType.MESSAGE_UPDATED, message.id, {
        action: "update_completed",
        success: true,
        update_media_group: updateMediaGroup,
      });

      toast({
        title: "Success",
        description: "Caption updated successfully",
      });

      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Error updating caption:", errorMessage);

      // Log error
      await logger.logEvent(LogEventType.SYSTEM_ERROR, message.id, {
        action: "update_caption",
        error: errorMessage,
      });

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });

      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  // Function to delete a message from the database only
  const deleteFromDatabase = async (messageUuid: string) => {
    try {
      // First archive the message
      const { data: archiveData, error: archiveError } = await supabase.rpc(
        "x_archive_message_for_deletion" as unknown as any,
        { p_message_id: messageUuid }
      );

      if (archiveError) {
        console.error("Error archiving message before deletion:", archiveError);
        throw archiveError;
      }

      // Then delete from messages table
      const { error: deleteError } = await supabase
        .from("messages")
        .delete()
        .eq("id", messageUuid);

      if (deleteError) throw deleteError;

      // Trigger storage cleanup
      try {
        await supabase.functions.invoke("cleanup-storage-on-delete", {
          body: { message_id: messageUuid },
        });
      } catch (storageError) {
        // Log but don't fail the operation
        console.warn("Storage cleanup may be delayed:", storageError);
      }

      return { success: true };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Error deleting message from database", errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  // Function to delete a message with two possible flows: DB only or DB + Telegram
  const deleteMessage = async (
    message: Message,
    deleteFromTelegram = false
  ) => {
    setIsDeleting(true);
    setIsProcessing(true);

    try {
      // Destructure needed message properties
      const {
        id: messageUuid,
        telegram_message_id: telegramMessageId,
        chat_id: chatId,
        media_group_id: mediaGroupId,
      } = message;

      // Validate required fields
      if (!messageUuid) {
        throw new Error("Message ID is missing");
      }

      // Log the operation
      await logger.logEvent(LogEventType.MESSAGE_DELETED, messageUuid, {
        operation: deleteFromTelegram
          ? "delete_from_telegram_and_db"
          : "delete_from_db_only",
        telegram_message_id: telegramMessageId,
        chat_id: chatId,
      });

      // If deleting from both Telegram and database
      if (deleteFromTelegram) {
        // Validate Telegram-specific fields
        if (!telegramMessageId || !chatId) {
          throw new Error(
            "Missing Telegram message details (message ID or chat ID)"
          );
        }

        // First archive the message
        const { data: archiveData, error: archiveError } = await supabase.rpc(
          "x_archive_message_for_deletion" as unknown as any,
          { p_message_id: messageUuid }
        );

        if (archiveError) {
          throw new Error(`Failed to archive message: ${archiveError.message}`);
        }

        // Delete from Telegram
        const telegramResult = await deleteTelegramMessage(
          telegramMessageId,
          chatId,
          mediaGroupId
        );

        if (!telegramResult.success) {
          throw new Error(
            `Failed to delete from Telegram: ${telegramResult.error}`
          );
        }

        // If Telegram deletion was successful, delete from database
        const dbResult = await deleteFromDatabase(messageUuid);

        if (!dbResult.success) {
          throw new Error(
            `Message deleted from Telegram but failed to delete from database: ${dbResult.error}`
          );
        }

        toast({
          title: "Success",
          description: "Message deleted from Telegram and database",
        });

        return true;
      } else {
        // Just delete from database
        const result = await deleteFromDatabase(messageUuid);

        if (!result.success) {
          throw new Error(`Failed to delete message: ${result.error}`);
        }

        toast({
          title: "Success",
          description: "Message deleted from database",
        });

        return true;
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Error in deleteMessage:", errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      return false;
    } finally {
      setIsDeleting(false);
      setIsProcessing(false);
    }
  };

  const handleForward = useCallback(
    async (message: Message, chatId: number): Promise<void> => {
      try {
        setIsProcessing(true);

        // Log the operation with consolidated logging
        await logger.logEvent(LogEventType.USER_ACTION, message.id, {
          action: "forward",
          target_chat_id: chatId,
          file_unique_id: message.file_unique_id,
        });

        // Call the Edge Function to handle forwarding
        const { error } = await supabase.functions.invoke(
          "xdelo_forward_message",
          {
            body: {
              messageId: message.id,
              targetChatId: chatId,
            },
          }
        );

        if (error) throw new Error(error.message);

        toast({
          title: "Message Forwarded",
          description: `Message has been forwarded to chat ID: ${chatId}`,
        });
      } catch (error) {
        console.error("Error forwarding message:", error);

        // Log the error with consolidated logging
        await logger.logEvent(LogEventType.SYSTEM_ERROR, message.id, {
          action: "forward",
          target_chat_id: chatId,
          error: error instanceof Error ? error.message : String(error),
        });

        toast({
          title: "Error",
          description: "Failed to forward message. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [toast]
  );

  const handleReprocess = useCallback(
    async (message: Message): Promise<void> => {
      try {
        setIsProcessing(true);

        // Log the operation with consolidated logging
        await logger.logEvent(LogEventType.MESSAGE_REPROCESSED, message.id, {
          action: "manual_reprocess",
        });

        // Call the Edge Function
        const { error } = await supabase.functions.invoke(
          "xdelo_reprocess_message",
          {
            body: {
              messageId: message.id,
              force: true,
            },
          }
        );

        if (error) throw new Error(error.message);

        toast({
          title: "Reprocessing Started",
          description: "The message has been queued for reprocessing.",
        });
      } catch (error) {
        console.error("Error reprocessing message:", error);

        // Log the error with consolidated logging
        await logger.logEvent(LogEventType.SYSTEM_ERROR, message.id, {
          action: "reprocess",
          error: error instanceof Error ? error.message : String(error),
        });

        toast({
          title: "Error",
          description: "Failed to reprocess message. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [toast]
  );

  return {
    deleteMessage,
    updateCaption,
    handleForward,
    handleReprocess,
    isDeleting,
    isProcessing,
  };
};
