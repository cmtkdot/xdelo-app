
import { supabase } from "@/integrations/supabase/client";
import { RepairResult, SyncCaptionResult, StandardizeResult } from "./types";
import { analyzeWithAI, parseCaption } from "@/lib/api";

/**
 * Single file operations hook
 */
export function useSingleFileOperations(
  addProcessingMessageId: (id: string) => void,
  removeProcessingMessageId: (id: string) => void
) {
  /**
   * Re-uploads media from Telegram using the file_id
   */
  const reuploadMediaFromTelegram = async (messageId: string): Promise<RepairResult> => {
    try {
      addProcessingMessageId(messageId);
      
      // Log the start of the operation
      console.log(`Re-uploading media from Telegram for message: ${messageId}`);
      
      // Call the redownload function
      const { data, error } = await supabase.functions.invoke('redownload-media', {
        body: { messageId },
      });
      
      if (error) {
        console.error('Error re-uploading media:', error);
        return {
          success: false,
          error: error.message,
          message: 'Failed to re-upload media'
        };
      }
      
      return {
        success: true,
        message: data?.message || 'Media re-uploaded successfully',
        data
      };
    } catch (error) {
      console.error('Error in reuploadMediaFromTelegram:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        message: 'An unexpected error occurred while re-uploading media'
      };
    } finally {
      removeProcessingMessageId(messageId);
    }
  };

  /**
   * Fixes the content disposition of a media file
   */
  const fixContentDispositionForMessage = async (messageId: string): Promise<RepairResult> => {
    try {
      addProcessingMessageId(messageId);
      
      // Log the start of the operation
      console.log(`Fixing content disposition for message: ${messageId}`);
      
      // Call the function to fix content disposition
      const { data, error } = await supabase.functions.invoke('fix-content-disposition', {
        body: { messageId },
      });
      
      if (error) {
        console.error('Error fixing content disposition:', error);
        return {
          success: false,
          error: error.message,
          message: 'Failed to fix content disposition'
        };
      }
      
      return {
        success: true,
        message: data?.message || 'Content disposition fixed successfully',
        data
      };
    } catch (error) {
      console.error('Error in fixContentDispositionForMessage:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        message: 'An unexpected error occurred while fixing content disposition'
      };
    } finally {
      removeProcessingMessageId(messageId);
    }
  };

  /**
   * Processes a single message
   */
  const processMessage = async (messageId: string): Promise<RepairResult> => {
    try {
      addProcessingMessageId(messageId);
      
      // Log the start of the operation
      console.log(`Processing message: ${messageId}`);
      
      // Call the function to process the message
      const { data, error } = await supabase.functions.invoke('process-single-message', {
        body: { messageId },
      });
      
      if (error) {
        console.error('Error processing message:', error);
        return {
          success: false,
          error: error.message,
          message: 'Failed to process message'
        };
      }
      
      return {
        success: true,
        message: data?.message || 'Message processed successfully',
        data
      };
    } catch (error) {
      console.error('Error in processMessage:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        message: 'An unexpected error occurred while processing the message'
      };
    } finally {
      removeProcessingMessageId(messageId);
    }
  };

  /**
   * Re-analyzes the caption of a message using AI
   */
  const reanalyzeMessageCaption = async (messageId: string): Promise<RepairResult> => {
    try {
      addProcessingMessageId(messageId);
      
      // Log the start of the operation
      console.log(`Re-analyzing caption for message: ${messageId}`);
      
      // Fetch the message from Supabase
      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .select('caption')
        .eq('id', messageId)
        .single();
      
      if (messageError) {
        console.error('Error fetching message:', messageError);
        return {
          success: false,
          error: messageError.message,
          message: 'Failed to fetch message'
        };
      }
      
      if (!messageData?.caption) {
        console.warn('Message has no caption to analyze.');
        return {
          success: false,
          message: 'Message has no caption to analyze'
        };
      }
      
      // Call the analyzeWithAI function
      const result = await analyzeWithAI(messageId, messageData.caption);
      
      if (!result.success) {
        console.error('AI analysis failed:', result.error);
        return {
          success: false,
          error: result.error,
          message: 'AI analysis failed'
        };
      }
      
      return {
        success: true,
        message: 'Caption re-analyzed successfully',
        data: result.data
      };
    } catch (error) {
      console.error('Error in reanalyzeMessageCaption:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        message: 'An unexpected error occurred while re-analyzing the caption'
      };
    } finally {
      removeProcessingMessageId(messageId);
    }
  };

  /**
   * Syncs the caption of a message to all messages in its media group
   */
  const syncMessageCaption = async (messageId: string): Promise<SyncCaptionResult> => {
    try {
      addProcessingMessageId(messageId);
      
      // Log the start of the operation
      console.log(`Syncing caption for message: ${messageId}`);
      
      // First, fetch media_group_id for the message
      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .select('media_group_id')
        .eq('id', messageId)
        .single();
      
      if (messageError || !messageData?.media_group_id) {
        console.error('Error fetching message or no media group found:', messageError);
        return {
          success: false,
          error: messageError?.message || 'No media group found',
          message: 'Failed to find media group for message'
        };
      }
      
      // Call the RPC function to sync the caption
      const { data, error } = await supabase
        .rpc('xdelo_sync_media_group_content', { 
          p_source_message_id: messageId,
          p_media_group_id: messageData.media_group_id
        });
      
      if (error) {
        console.error('Error syncing caption:', error);
        return {
          success: false,
          error: error.message,
          message: 'Failed to sync caption'
        };
      }
      
      // Check if data is available and has the expected structure
      const syncResult: SyncCaptionResult = {
        success: true,
        message: 'Caption synchronized successfully'
      };
      
      // Only try to access properties if data exists and is an object
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        syncResult.message = (data.message as string) || syncResult.message;
        syncResult.synced = (data.updated_count as number) || 0;
        syncResult.skipped = (data.skipped as number) || 0;
        syncResult.data = data;
      }
      
      return syncResult;
    } catch (error) {
      console.error('Error in syncMessageCaption:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        message: 'An unexpected error occurred while syncing the caption'
      };
    } finally {
      removeProcessingMessageId(messageId);
    }
  };

  /**
   * Standardizes storage paths for media files
   */
  const standardizeStoragePaths = async (limit: number = 100): Promise<StandardizeResult> => {
    try {
      console.log(`Standardizing storage paths for up to ${limit} messages`);
      
      const { data, error } = await supabase
        .rpc('xdelo_fix_public_urls', { p_limit: limit });
      
      if (error) {
        console.error('Error standardizing storage paths:', error);
        return {
          success: false,
          error: error.message,
          message: 'Failed to standardize storage paths'
        };
      }
      
      return {
        success: true,
        message: `Updated ${data?.length || 0} message URLs`,
        successful: data?.length || 0
      };
    } catch (error) {
      console.error('Error in standardizeStoragePaths:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        message: 'An unexpected error occurred while standardizing storage paths'
      };
    }
  };

  return {
    reuploadMediaFromTelegram,
    fixContentDispositionForMessage,
    processMessage,
    reanalyzeMessageCaption,
    syncMessageCaption,
    standardizeStoragePaths
  };
}
