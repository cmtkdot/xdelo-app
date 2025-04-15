
import { useState, useCallback } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Message } from "@/types/entities/Message";

// Type for response from reupload function
interface ReuploadResponse {
  success: boolean;
  message?: string;
  data?: any;
}

/**
 * Hook for media utilities and operations
 */
export function useMediaUtils() {
  const [processingMessageIds, setProcessingMessageIds] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  /**
   * Re-upload media from Telegram
   */
  const reuploadMediaFromTelegram = useCallback(async (message: Message): Promise<ReuploadResponse> => {
    if (!message.id) {
      toast({
        title: "Error",
        description: "Message ID is required",
        variant: "destructive",
      });
      return { success: false, message: "Message ID is required" };
    }

    try {
      // Mark as processing
      setProcessingMessageIds(prev => ({ ...prev, [message.id]: true }));

      // Call the Supabase function to reupload the media
      const { data, error } = await supabase.rpc('admin_reupload_media_from_telegram', {
        p_message_id: message.id
      });

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
      const response = data as ReuploadResponse;
      
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
        delete newState[message.id];
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
      const { data, error } = await supabase.rpc('admin_fix_media_group_captions', {
        p_media_group_id: mediaGroupId
      });

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
      const response = data as ReuploadResponse;
      
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

  return {
    reuploadMediaFromTelegram,
    fixMediaGroupCaptions,
    processingMessageIds
  };
}
