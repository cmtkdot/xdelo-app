import { useToast } from "@/hooks/useToast";
import { supabase } from "@/integrations/supabase/client";
import { Message } from "@/types/entities/Message";
import { useCallback, useState } from "react";

// Define more specific types to replace any
interface JsonData {
  [key: string]: string | number | boolean | null | JsonData | JsonData[];
}

// Type for response from reupload function
interface ReuploadResponse {
  success: boolean;
  message?: string;
  data?: JsonData;
}

// Type for response from functions
interface RPCResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: Record<string, unknown>;
}

// Custom type for RPC function names to bypass TypeScript checking
type RPCFunctionName = string;

/**
 * Hook for media utilities and operations
 */
export function useMediaUtils() {
  const [processingMessageIds, setProcessingMessageIds] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  /**
   * Re-upload media from Telegram
   */
  const reuploadMediaFromTelegram = useCallback(async (message: Message | string): Promise<ReuploadResponse> => {
    const messageId = typeof message === 'string' ? message : message.id;

    if (!messageId) {
      toast({
        title: "Error",
        description: "Message ID is required",
        variant: "destructive",
      });
      return { success: false, message: "Message ID is required" };
    }

    try {
      // Mark as processing
      setProcessingMessageIds(prev => ({ ...prev, [messageId]: true }));

      // Call the Supabase function to reupload the media
      const { data, error } = await supabase.rpc(
        // Double cast to bypass TypeScript checking
        'admin_reupload_media_from_telegram' as unknown as any,
        { p_message_id: messageId }
      );

      if (error) {
        console.error("Error re-uploading media:", error);
        toast({
          title: "Media Re-upload Failed",
          description: error.message,
          variant: "destructive",
        });
        return { success: false, message: error.message };
      }

      // Handle the response data properly with type assertion
      const response = data as unknown as ReuploadResponse;

      if (response && response.success) {
        toast({
          title: "Media Re-upload Successful",
          description: response.message || "Media has been re-uploaded successfully.",
        });
        return { success: true, message: response.message, data: response.data };
      } else {
        toast({
          title: "Media Re-upload Failed",
          description: response.message || "Failed to re-upload media.",
          variant: "destructive",
        });
        return { success: false, message: response.message };
      }
    } catch (error) {
      console.error("Exception during media re-upload:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      toast({
        title: "Media Re-upload Error",
        description: errorMessage,
        variant: "destructive",
      });
      return { success: false, message: errorMessage };
    } finally {
      // Clear processing state
      setProcessingMessageIds(prev => {
        const newState = { ...prev };
        delete newState[messageId];
        return newState;
      });
    }
  }, [toast]);

  /**
   * Fix media group captions
   */
  const fixMediaGroupCaptions = useCallback(async (mediaGroupId: string): Promise<ReuploadResponse> => {
    if (!mediaGroupId) {
      toast({
        title: "Error",
        description: "Media group ID is required",
        variant: "destructive",
      });
      return { success: false, message: "Media group ID is required" };
    }

    try {
      // Call the Supabase function to fix media group captions
      const { data, error } = await supabase.rpc(
        // Double cast to bypass TypeScript checking
        'admin_fix_media_group_captions' as unknown as any,
        { p_media_group_id: mediaGroupId }
      );

      if (error) {
        console.error("Error fixing media group captions:", error);
        toast({
          title: "Fix Captions Failed",
          description: error.message,
          variant: "destructive",
        });
        return { success: false, message: error.message };
      }

      // Handle the response data properly with type assertion
      const response = data as unknown as ReuploadResponse;

      if (response && response.success) {
        toast({
          title: "Caption Fix Successful",
          description: response.message || "Media group captions have been fixed.",
        });
        return { success: true, message: response.message, data: response.data };
      } else {
        toast({
          title: "Caption Fix Failed",
          description: response.message || "Failed to fix media group captions.",
          variant: "destructive",
        });
        return { success: false, message: response.message };
      }
    } catch (error) {
      console.error("Exception during caption fix:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      toast({
        title: "Caption Fix Error",
        description: errorMessage,
        variant: "destructive",
      });
      return { success: false, message: errorMessage };
    }
  }, [toast]);

  /**
   * Fix content disposition for a message
   */
  const fixContentDispositionForMessage = useCallback(async (messageId: string): Promise<ReuploadResponse> => {
    if (!messageId) {
      toast({
        title: "Error",
        description: "Message ID is required",
        variant: "destructive",
      });
      return { success: false, message: "Message ID is required" };
    }

    try {
      setProcessingMessageIds(prev => ({ ...prev, [messageId]: true }));

      // Call the Supabase function to fix content disposition
      const { data, error } = await supabase.rpc(
        // Double cast to bypass TypeScript checking
        'admin_fix_content_disposition' as unknown as any,
        { p_message_id: messageId }
      );

      if (error) {
        console.error("Error fixing content disposition:", error);
        toast({
          title: "Fix Content Disposition Failed",
          description: error.message,
          variant: "destructive",
        });
        return { success: false, message: error.message };
      }

      // Handle the response data properly with type assertion
      const response = data as unknown as ReuploadResponse;

      if (response && response.success) {
        toast({
          title: "Content Disposition Fixed",
          description: response.message || "Content disposition has been fixed.",
        });
        return { success: true, message: response.message, data: response.data };
      } else {
        toast({
          title: "Fix Content Disposition Failed",
          description: response.message || "Failed to fix content disposition.",
          variant: "destructive",
        });
        return { success: false, message: response.message };
      }
    } catch (error) {
      console.error("Exception during content disposition fix:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      toast({
        title: "Fix Content Disposition Error",
        description: errorMessage,
        variant: "destructive",
      });
      return { success: false, message: errorMessage };
    } finally {
      setProcessingMessageIds(prev => {
        const newState = { ...prev };
        delete newState[messageId];
        return newState;
      });
    }
  }, [toast]);

  /**
   * Repair a batch of media items
   */
  const repairMediaBatch = useCallback(async (messageIds: string[]): Promise<ReuploadResponse> => {
    if (!messageIds.length) {
      toast({
        title: "Error",
        description: "No messages selected for repair",
        variant: "destructive",
      });
      return { success: false, message: "No messages selected for repair" };
    }

    try {
      // Mark all as processing
      const processingIds = messageIds.reduce<Record<string, boolean>>((acc, id) => {
        acc[id] = true;
        return acc;
      }, {});

      setProcessingMessageIds(prev => ({ ...prev, ...processingIds }));

      // Call the Supabase function to repair batch
      const { data, error } = await supabase.rpc(
        // Double cast to bypass TypeScript checking
        'admin_repair_media_batch' as unknown as any,
        { p_message_ids: messageIds }
      );

      if (error) {
        console.error("Error repairing media batch:", error);
        toast({
          title: "Batch Repair Failed",
          description: error.message,
          variant: "destructive",
        });
        return { success: false, message: error.message };
      }

      // Handle the response data properly with type assertion
      const response = data as unknown as ReuploadResponse;

      if (response && response.success) {
        toast({
          title: "Batch Repair Successful",
          description: response.message || `Repaired ${messageIds.length} messages.`,
        });
        return { success: true, message: response.message, data: response.data };
      } else {
        toast({
          title: "Batch Repair Failed",
          description: response.message || "Failed to repair media batch.",
          variant: "destructive",
        });
        return { success: false, message: response.message };
      }
    } catch (error) {
      console.error("Exception during batch repair:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      toast({
        title: "Batch Repair Error",
        description: errorMessage,
        variant: "destructive",
      });
      return { success: false, message: errorMessage };
    } finally {
      // Clear all processing states
      setProcessingMessageIds(prev => {
        const newState = { ...prev };
        messageIds.forEach(id => {
          delete newState[id];
        });
        return newState;
      });
    }
  }, [toast]);

  /**
   * Sync the caption of a message with Telegram
   */
  const syncMessageCaption = async (messageId: string, newCaption: string) => {
    try {
      setProcessingMessageIds(prev => ({ ...prev, [messageId]: true }));

      // Use the new RPC function with type casting to bypass TS errors
      const { data, error } = await supabase.rpc(
        // Double cast to bypass TypeScript checking
        'x_sync_message_caption_edge' as unknown as any,
        {
          p_message_id: messageId,
          p_new_caption: newCaption
        }
      );

      if (error) {
        toast({
          variant: 'destructive',
          title: 'Caption Update Failed',
          description: `Failed to update caption: ${error.message}`,
        });
        return false;
      }

      // Cast data to our expected response type
      const response = data as unknown as RPCResponse;

      if (response && response.success) {
        toast({
          title: 'Caption Updated',
          description: 'Caption has been updated successfully.',
        });

        // Refresh the page instead of using a missing refreshMessage function
        window.location.reload();
        return true;
      } else {
        toast({
          variant: 'destructive',
          title: 'Caption Update Failed',
          description: response?.error || 'Unknown error occurred',
        });
        return false;
      }
    } catch (error) {
      console.error('Error syncing caption:', error);
      toast({
        variant: 'destructive',
        title: 'Caption Update Failed',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
      });
      return false;
    } finally {
      setProcessingMessageIds(prev => {
        const newState = { ...prev };
        delete newState[messageId];
        return newState;
      });
    }
  };

  return {
    reuploadMediaFromTelegram,
    fixMediaGroupCaptions,
    fixContentDispositionForMessage,
    repairMediaBatch,
    syncMessageCaption,
    processingMessageIds
  };
}
