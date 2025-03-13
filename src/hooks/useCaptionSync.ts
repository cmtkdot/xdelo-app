import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Message, ProcessingState } from "@/types/MessagesTypes";
import { useToast } from "@/hooks/useToast";
import { logSyncOperation } from "@/lib/logUtils";
import { LogEventType } from "@/types/api/LogEventType";

export interface UpdateMessageParams {
  id: string;
  caption?: string;
  is_original_caption?: boolean;
  analyzed_content?: any;
  purchase_order?: string;
}

export interface CaptionSyncParams {
  messageId: string;
  force?: boolean;
}

interface ProcessCaptionUpdateParams {
  id: string;
  caption?: string;
  media_group_id?: string;
}

interface ProcessCaptionUpdateResult {
  success: boolean;
  error?: string;
}

export const useCaptionSync = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Function to update a message
  const updateMessage = async (params: UpdateMessageParams): Promise<Message> => {
    const { id, ...updates } = params;
    const { data, error } = await supabase
      .from('messages')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error("Error updating message:", error);
      throw error;
    }

    return data as Message;
  };

  // Updated function to handle caption processing through edge function
  const processCaptionUpdate = async (message: ProcessCaptionUpdateParams, newCaption: string): Promise<ProcessCaptionUpdateResult> => {
    try {
      // Call the update-telegram-caption edge function
      const { data, error } = await supabase.functions.invoke('update-telegram-caption', {
        body: { 
          messageId: message.id, 
          newCaption 
        }
      });

      if (error) {
        console.error("Error processing caption update:", error);
        throw new Error(error.message || 'Failed to update caption');
      }

      // Invalidate queries to refresh the UI after successful update
      queryClient.invalidateQueries({ queryKey: ['media-groups'] });
      
      return { success: true };
    } catch (err: any) {
      console.error("Error in processCaptionUpdate:", err);
      return { 
        success: false,
        error: err.message || 'Unknown error occurred during caption update'
      };
    }
  };

  // Mutation for updating a single message
  const useUpdateMessageMutation = () => {
    return useMutation({
      mutationFn: updateMessage,
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['media-groups'] });
      },
      onError: (error: any) => {
        console.error("Error updating message:", error.message);
        toast({
          title: "Update Failed",
          description: error.message || "Failed to update message",
          variant: "destructive",
        });
      },
    });
  };

  // Function to sync caption to the media group
  const syncCaptionToMediaGroup = async (messageId: string): Promise<void> => {
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (messageError) {
      console.error("Error fetching message:", messageError);
      throw new Error(`Failed to fetch message: ${messageError.message}`);
    }

    const currentMessage = message as Message;
    const mediaGroupId = currentMessage.media_group_id || currentMessage.id;
    const caption = currentMessage.caption;

    if (!caption) {
      throw new Error("No caption to sync.");
    }

    // Fetch all messages in the media group
    const { data: mediaGroupMessages, error: mediaGroupError } = await supabase
      .from('messages')
      .select('*')
      .eq('media_group_id', mediaGroupId);

    if (mediaGroupError) {
      console.error("Error fetching media group messages:", mediaGroupError);
      throw new Error(`Failed to fetch media group messages: ${mediaGroupError.message}`);
    }

    const messagesToUpdate = mediaGroupMessages
      ?.map(msg => msg as Message)
      .filter(msg => msg.id !== messageId);

    // Update all messages in the media group with the caption
    const updates = messagesToUpdate?.map(msg => ({
      id: msg.id,
      caption: caption,
      group_caption_synced: true
    }));

    if (updates && updates.length > 0) {
      const { error: updateError } = await supabase
        .from('messages')
        .upsert(updates);

      if (updateError) {
        console.error("Error updating media group messages:", updateError);
        throw new Error(`Failed to update media group messages: ${updateError.message}`);
      }
    }
    
    // Log the sync operation
    await logSyncOperation(
      LogEventType.SYNC_COMPLETED,
      messageId,
      {
        action: 'sync_caption',
        media_group_id: mediaGroupId,
        messages_updated: updates?.length || 0
      },
      true
    );
  };

  // Mutation for syncing caption to media group
  const useSyncCaptionToMediaGroupMutation = () => {
    return useMutation({
      mutationFn: syncCaptionToMediaGroup,
      onSuccess: () => {
        console.log("Caption synced to media group successfully.");
        queryClient.invalidateQueries({ queryKey: ['media-groups'] });
      },
      onError: (error: any) => {
        console.error("Error syncing caption to media group:", error.message);
        toast({
          title: "Sync Failed",
          description: error.message || "Failed to sync caption to media group",
          variant: "destructive",
        });
      },
    });
  };

  // Function to force sync a message group
  const forceSyncMessageGroup = async (params: CaptionSyncParams): Promise<void> => {
    const { messageId, force = false } = params;
    
    // Fetch the message
    const { data: messageData, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (messageError) {
      console.error("Error fetching message:", messageError);
      throw new Error(`Failed to fetch message: ${messageError.message}`);
    }

    const message = messageData as Message;
    const mediaGroupId = message.media_group_id || message.id;

    // Call the edge function to sync the media group
    const { data, error } = await supabase.functions.invoke('xdelo_sync_media_group', {
      body: { 
        message_id: messageId,
        media_group_id: mediaGroupId,
        force: force
      }
    });

    if (error) {
      console.error("Error invoking sync media group function:", error);
      throw new Error(`Failed to sync media group: ${error.message}`);
    }

    // Log the sync operation
    try {
      await logSyncOperation(
        LogEventType.SYNC_COMPLETED,
        messageId,
        {
          media_group_id: mediaGroupId,
          message_count: data?.synced_count || 0,
          force: force
        },
        true
      );
    } catch (logError) {
      console.error("Error logging sync operation:", logError);
    }
  };

  // Mutation for force syncing a message group
  const useForceSyncMessageGroupMutation = () => {
    return useMutation({
      mutationFn: forceSyncMessageGroup,
      onSuccess: () => {
        console.log("Media group synced successfully.");
        queryClient.invalidateQueries({ queryKey: ['media-groups'] });
      },
      onError: (error: any) => {
        console.error("Error syncing media group:", error.message);
        toast({
          title: "Sync Failed",
          description: error.message || "Failed to sync media group",
          variant: "destructive",
        });
      },
    });
  };

  // Function to process a single message
  const processSingleMessage = async (messageId: string): Promise<void> => {
    // Call edge function to reprocess the message
    const { data, error } = await supabase.functions.invoke('xdelo_reprocess_message', {
      body: { 
        message_id: messageId
      }
    });

    if (error) {
      console.error("Error reprocessing message:", error);
      throw new Error(`Failed to reprocess message: ${error.message}`);
    }

    // Log the reprocess operation
    try {
      await logSyncOperation(
        LogEventType.MESSAGE_REPROCESSED,
        messageId,
        {
          result: data,
          timestamp: new Date().toISOString()
        },
        true
      );
    } catch (logError) {
      console.error("Error logging reprocess operation:", logError);
    }
  };

  // Mutation for processing a single message
  const useProcessSingleMessageMutation = () => {
    return useMutation({
      mutationFn: processSingleMessage,
      onSuccess: () => {
        console.log("Message processed successfully.");
        queryClient.invalidateQueries({ queryKey: ['media-groups'] });
      },
      onError: (error: any) => {
        console.error("Error processing message:", error.message);
        toast({
          title: "Processing Failed",
          description: error.message || "Failed to process message",
          variant: "destructive",
        });
      },
    });
  };

  // Function to process all pending messages
  const processAllPendingMessages = async (): Promise<void> => {
    // Fetch all pending messages
    const { data: pendingMessages, error: pendingMessagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('processing_state', 'pending');

    if (pendingMessagesError) {
      console.error("Error fetching pending messages:", pendingMessagesError);
      throw new Error(`Failed to fetch pending messages: ${pendingMessagesError.message}`);
    }

    const messages = pendingMessages?.map(msg => msg as Message) || [];

    if (messages.length === 0) {
      console.log("No pending messages found.");
      return;
    }

    // Process each pending message
    const results = [];
    for (const message of messages) {
      try {
        await processSingleMessage(message.id);
        results.push({
          id: message.id,
          success: true
        });
        console.log(`Message ${message.id} processed successfully.`);
      } catch (error: any) {
        results.push({
          id: message.id,
          success: false,
          error: error.message
        });
        console.error(`Error processing message ${message.id}:`, error.message);
      }
    }

    // Log batch processing results
    try {
      await logSyncOperation(
        LogEventType.SYNC_COMPLETED,
        'batch',
        {
          action: 'batch_process',
          total: messages.length,
          results: results,
          timestamp: new Date().toISOString()
        },
        true
      );
    } catch (logError) {
      console.error("Error logging batch processing:", logError);
    }
  };

  // Mutation for processing all pending messages
  const useProcessAllPendingMessagesMutation = () => {
    return useMutation({
      mutationFn: processAllPendingMessages,
      onSuccess: () => {
        console.log("All pending messages processed successfully.");
        toast({
          title: "Processing Complete",
          description: "All pending messages have been processed.",
          variant: "default",
        });
        queryClient.invalidateQueries({ queryKey: ['media-groups'] });
      },
      onError: (error: any) => {
        console.error("Error processing all pending messages:", error.message);
        toast({
          title: "Processing Failed",
          description: error.message || "Failed to process all pending messages",
          variant: "destructive",
        });
      },
    });
  };

  return {
    updateMessage,
    useUpdateMessageMutation,
    processCaptionUpdate,
    syncCaptionToMediaGroup,
    useSyncCaptionToMediaGroupMutation,
    forceSyncMessageGroup,
    useForceSyncMessageGroupMutation,
    processSingleMessage,
    useProcessSingleMessageMutation,
    processAllPendingMessages,
    useProcessAllPendingMessagesMutation,
  };
};
