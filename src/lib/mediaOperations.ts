import { supabase } from '@/integrations/supabase/client';
import { Message } from '@/types/entities/Message';

export interface RepairResult {
  success: boolean;
  message?: string;
  error?: string;
  data?: any;
  successful?: number;
  failed?: number;
  retryCount?: number;
}

/**
 * Process a message to analyze its content and update storage
 */
export async function processMessage(messageId: string): Promise<RepairResult> {
  try {
    const { data, error } = await supabase.functions.invoke('xdelo_reprocess_message', {
      body: { messageId }
    });

    if (error) {
      console.error('Error processing message:', error);
      return {
        success: false,
        message: error.message || 'Failed to process message'
      };
    }

    return {
      success: true,
      message: 'Message processed successfully',
      data
    };
  } catch (error) {
    console.error('Error in processMessage:', error);
    return {
      success: false,
      message: error.message || 'An unknown error occurred'
    };
  }
}

/**
 * Reanalyze a message caption
 */
export async function reanalyzeMessageCaption(message: Message): Promise<RepairResult> {
  try {
    if (!message.caption) {
      return {
        success: false,
        message: 'Message has no caption to analyze'
      };
    }

    // Generate a correlation ID
    const correlationId = crypto.randomUUID().toString();

    // Call database function directly instead of edge function
    const { data, error } = await supabase.rpc(
      'xdelo_process_caption_workflow',
      {
        p_message_id: message.id,
        p_correlation_id: correlationId,
        p_force: true
      }
    );

    if (error) {
      console.error('Error analyzing caption:', error);
      return {
        success: false,
        message: error.message || 'Failed to analyze caption'
      };
    }

    return {
      success: true,
      message: 'Caption analyzed successfully',
      data
    };
  } catch (error) {
    console.error('Error in reanalyzeMessageCaption:', error);
    return {
      success: false,
      message: error.message || 'An unknown error occurred'
    };
  }
}

/**
 * Fix content disposition for a message
 */
export async function fixContentDisposition(messageId: string): Promise<RepairResult> {
  try {
    const { data, error } = await supabase.functions.invoke('xdelo_fix_content_disposition', {
      body: { messageId }
    });

    if (error) {
      console.error('Error fixing content disposition:', error);
      return {
        success: false,
        message: error.message || 'Failed to fix content disposition'
      };
    }

    return {
      success: true,
      message: 'Content disposition fixed successfully',
      data
    };
  } catch (error) {
    console.error('Error in fixContentDisposition:', error);
    return {
      success: false,
      message: error.message || 'An unknown error occurred'
    };
  }
}

/**
 * Reupload media from Telegram
 */
export async function reuploadMediaFromTelegram(messageId: string): Promise<RepairResult> {
  try {
    const { data, error } = await supabase.functions.invoke('xdelo_reupload_media', {
      body: { 
        messageId,
        forceRedownload: true 
      }
    });

    if (error) {
      console.error('Error reuploading media from Telegram:', error);
      return {
        success: false,
        message: error.message || 'Failed to reupload media from Telegram'
      };
    }

    return {
      success: true,
      message: 'Media successfully reuploaded from Telegram',
      data
    };
  } catch (error) {
    console.error('Error in reuploadMediaFromTelegram:', error);
    return {
      success: false,
      message: error.message || 'An unknown error occurred'
    };
  }
}

/**
 * Standardize storage paths
 */
export async function standardizeStoragePaths(limit: number = 100): Promise<RepairResult> {
  try {
    const { data, error } = await supabase.functions.invoke('xdelo_standardize_storage_paths', {
      body: { 
        limit,
        dryRun: false 
      }
    });

    if (error) {
      console.error('Error standardizing storage paths:', error);
      return {
        success: false,
        message: error.message || 'Failed to standardize storage paths',
        successful: 0
      };
    }

    return {
      success: true,
      message: `Successfully standardized ${data?.processed || 0} paths`,
      successful: data?.processed || 0,
      data
    };
  } catch (error) {
    console.error('Error in standardizeStoragePaths:', error);
    return {
      success: false,
      message: error.message || 'An unknown error occurred',
      successful: 0
    };
  }
}

/**
 * Fix media URLs
 */
export async function fixMediaUrls(limit: number = 100): Promise<RepairResult> {
  try {
    const { data, error } = await supabase.functions.invoke('xdelo_fix_media_urls', {
      body: { 
        limit,
        fixMissingPublicUrls: true,
        regenerateUrls: false
      }
    });

    if (error) {
      console.error('Error fixing media URLs:', error);
      return {
        success: false,
        message: error.message || 'Failed to fix media URLs',
        successful: 0
      };
    }

    return {
      success: true,
      message: `Successfully fixed ${data?.processed || 0} URLs`,
      successful: data?.processed || 0,
      data
    };
  } catch (error) {
    console.error('Error in fixMediaUrls:', error);
    return {
      success: false,
      message: error.message || 'An unknown error occurred',
      successful: 0
    };
  }
}

/**
 * Repair multiple messages
 */
export async function repairMediaBatch(messageIds: string[]): Promise<RepairResult> {
  try {
    // If no specific messages provided, repair all that need it
    const payload = messageIds.length > 0 
      ? { messageIds } 
      : { limit: 100, repairAll: true };
    
    const { data, error } = await supabase.functions.invoke('xdelo_unified_media_repair', {
      body: payload
    });

    if (error) {
      console.error('Error repairing media batch:', error);
      return {
        success: false,
        message: error.message || 'Failed to repair media batch',
        successful: 0,
        failed: messageIds.length
      };
    }

    return {
      success: true,
      message: `Successfully repaired ${data?.successful || 0} messages`,
      successful: data?.successful || 0,
      failed: data?.failed || 0,
      data
    };
  } catch (error) {
    console.error('Error in repairMediaBatch:', error);
    return {
      success: false,
      message: error.message || 'An unknown error occurred',
      successful: 0,
      failed: messageIds.length
    };
  }
}
