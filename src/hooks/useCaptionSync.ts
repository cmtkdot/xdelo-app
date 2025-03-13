import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Message, ProcessingState } from "@/types/MessagesTypes";
import { useToast } from "@/hooks/useToast";
import { logSyncOperation } from "@/lib/syncLogger";

interface UpdateMessageParams {
  id: string;
  caption?: string;
  is_original_caption?: boolean;
  analyzed_content?: any;
  purchase_order?: string;
}

interface CaptionSyncParams {
  messageId: string;
  force?: boolean;
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

  // Mutation for updating a single message
  const useUpdateMessageMutation = () => {
    return useMutation(updateMessage, {
      onSuccess: (data) => {
        console.log("Message updated successfully:", data);
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
  };

  // Mutation for syncing caption to media group
  const useSyncCaptionToMediaGroupMutation = () => {
    return useMutation(syncCaptionToMediaGroup, {
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
  const forceSyncMessageGroup = async ({ messageId, force = false }: CaptionSyncParams): Promise<void> => {
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

    // Fetch all messages in the media group
    const { data: mediaGroup, error: mediaGroupError } = await supabase
      .from('messages')
      .select('*')
      .eq('media_group_id', mediaGroupId)
      .order('created_at', { ascending: true });

    if (mediaGroupError) {
      console.error("Error fetching media group:", mediaGroupError);
      throw new Error(`Failed to fetch media group: ${mediaGroupError.message}`);
    }

    const messages = mediaGroup?.map(msg => msg as Message) || [];

    if (messages.length === 0) {
      throw new Error("No messages found in the media group.");
    }

    // Find the original caption message or the first message in the group
    let originalCaptionMessage = messages.find(msg => msg.is_original_caption);
    if (!originalCaptionMessage) {
      originalCaptionMessage = messages[0];
    }

    // If no caption exists, return
    if (!originalCaptionMessage.caption) {
      throw new Error("No caption found in the media group.");
    }

    // Update all messages in the media group with the original caption
    const updates = messages.map(msg => ({
      id: msg.id,
      caption: originalCaptionMessage?.caption,
      is_original_caption: msg.id === originalCaptionMessage?.id,
      group_caption_synced: true
    }));

    // Execute the updates
    const { error: updateError } = await supabase
      .from('messages')
      .upsert(updates);

    if (updateError) {
      console.error("Error updating media group messages:", updateError);
      throw new Error(`Failed to update media group messages: ${updateError.message}`);
    }

    // Log the sync operation
    try {
      await logSyncOperation('sync', messageId, {
        media_group_id: mediaGroupId,
        message_count: messages.length,
        force: force
      });
    } catch (logError) {
      console.error("Error logging sync operation:", logError);
    }
  };

  // Mutation for force syncing a message group
  const useForceSyncMessageGroupMutation = () => {
    return useMutation(forceSyncMessageGroup, {
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

    // Check if the message is already processing or completed
    if (message.processing_state === 'processing' || message.processing_state === 'completed') {
      console.log(`Message ${messageId} is already ${message.processing_state}. Skipping.`);
      return;
    }

    // Update the message state to processing
    const { error: processingStartError } = await supabase
      .from('messages')
      .update({ processing_state: 'processing', processing_started_at: new Date().toISOString() })
      .eq('id', messageId);

    if (processingStartError) {
      console.error("Error updating message state to processing:", processingStartError);
      throw new Error(`Failed to update message state to processing: ${processingStartError.message}`);
    }

    // Simulate processing (replace with actual processing logic)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Update the message state to completed
    const { error: processingCompleteError } = await supabase
      .from('messages')
      .update({ processing_state: 'completed', processing_completed_at: new Date().toISOString() })
      .eq('id', messageId);

    if (processingCompleteError) {
      console.error("Error updating message state to completed:", processingCompleteError);
      throw new Error(`Failed to update message state to completed: ${processingCompleteError.message}`);
    }

    // Log the sync operation
    try {
      await logSyncOperation('process', messageId, {
        processing_state: 'completed'
      });
    } catch (logError) {
      console.error("Error logging sync operation:", logError);
    }
  };

  // Mutation for processing a single message
  const useProcessSingleMessageMutation = () => {
    return useMutation(processSingleMessage, {
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
    for (const message of messages) {
      try {
        await processSingleMessage(message.id);
        console.log(`Message ${message.id} processed successfully.`);
      } catch (error: any) {
        console.error(`Error processing message ${message.id}:`, error.message);
        toast({
          title: "Processing Failed",
          description: error.message || `Failed to process message ${message.id}`,
          variant: "destructive",
        });
      }
    }
  };

  // Mutation for processing all pending messages
  const useProcessAllPendingMessagesMutation = () => {
    return useMutation(processAllPendingMessages, {
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
