import { supabase } from '@/integrations/supabase/client';
import { Message } from '@/types/entities/Message';
import { useToast } from '@/hooks/useToast';
import { logEvent, LogEventType } from '@/lib/logUtils';

// Define common return types for repair operations
export interface RepairResult {
  success: boolean;
  successful?: number;
  failed?: number;
  errors?: string[];
  message?: string;
  retryCount?: number;
}

/**
 * Fix content disposition for a single message
 */
export async function fixContentDisposition(messageId: string): Promise<RepairResult> {
  try {
    const { data, error } = await supabase.functions.invoke('xdelo_fix_content_disposition', {
      body: { messageId }
    });
    
    if (error) throw new Error(error.message);
    
    return { success: true, message: 'Content disposition fixed successfully' };
  } catch (error) {
    console.error('Error fixing content disposition:', error);
    
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Reupload media from Telegram
 */
export async function reuploadMediaFromTelegram(messageId: string): Promise<RepairResult> {
  try {
    const { data, error } = await supabase.functions.invoke('xdelo_reprocess_message', {
      body: { messageId, force: true }
    });
    
    if (error) throw new Error(error.message);
    
    return { success: true, message: 'Media reuploaded successfully' };
  } catch (error) {
    console.error('Error reuploading media:', error);
    
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Standardize storage paths for multiple messages
 */
export async function standardizeStoragePaths(limit: number = 100): Promise<RepairResult> {
  try {
    const { data, error } = await supabase.functions.invoke('xdelo_standardize_storage_paths', {
      body: { limit }
    });
    
    if (error) throw new Error(error.message);
    
    return { 
      success: true, 
      successful: data?.processed || 0,
      message: 'Storage paths standardized successfully'
    };
  } catch (error) {
    console.error('Error standardizing storage paths:', error);
    
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Fix media URLs
 */
export async function fixMediaUrls(limit: number = 100): Promise<RepairResult> {
  try {
    const { data, error } = await supabase.functions.invoke('xdelo_fix_media_urls', {
      body: { limit }
    });
    
    if (error) throw new Error(error.message);
    
    return { 
      success: true, 
      successful: data?.processed || 0,
      message: 'Media URLs fixed successfully'
    };
  } catch (error) {
    console.error('Error fixing media URLs:', error);
    
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Repair a batch of media messages
 */
export async function repairMediaBatch(messageIds: string[]): Promise<RepairResult> {
  if (!messageIds.length) {
    return { 
      success: false, 
      message: 'No messages to repair'
    };
  }
  
  try {
    // Group messageIds into batches of 10 to avoid timeout issues
    const batchSize = 10;
    const batches = [];
    for (let i = 0; i < messageIds.length; i += batchSize) {
      batches.push(messageIds.slice(i, i + batchSize));
    }
    
    let successful = 0;
    let failed = 0;
    const errors: string[] = [];
    
    // Process each batch sequentially
    for (const batch of batches) {
      try {
        const { data, error } = await supabase.functions.invoke('xdelo_file_repair', {
          body: { messageIds: batch }
        });
        
        if (error) throw new Error(error.message);
        
        successful += data?.results?.successful || 0;
        failed += data?.results?.failed || 0;
        
        if (data?.results?.errors && data.results.errors.length) {
          errors.push(...data.results.errors);
        }
      } catch (error) {
        console.error(`Error processing batch:`, error);
        failed += batch.length;
        errors.push(error instanceof Error ? error.message : 'Unknown batch error');
      }
    }
    
    return {
      success: successful > 0,
      successful,
      failed,
      errors,
      message: `Repaired ${successful} of ${messageIds.length} files`
    };
  } catch (error) {
    console.error('Error repairing media batch:', error);
    
    return { 
      success: false,
      failed: messageIds.length,
      errors: [error instanceof Error ? error.message : 'Unknown error occurred'],
      message: 'Failed to repair media batch'
    };
  }
}

/**
 * Process a message to repair content with improved error handling
 */
export async function processMessage(messageId: string): Promise<RepairResult> {
  let retryCount = 0;
  const maxRetries = 2;
  
  while (retryCount <= maxRetries) {
    try {
      // First, set the message to pending state
      const { error: updateError } = await supabase.from('messages')
        .update({ 
          processing_state: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId);
      
      if (updateError) throw updateError;
      
      // Call the edge function to process this specific message
      const { data, error } = await supabase.functions.invoke(
        'direct-caption-processor',
        {
          body: { 
            messageId,
            trigger_source: 'manual',
            retryCount
          }
        }
      );
      
      if (error) throw error;
      
      return {
        success: true,
        message: `Successfully processed message ${messageId.substring(0, 8)}.`,
        retryCount
      };
    } catch (error) {
      console.error(`Processing attempt ${retryCount + 1}/${maxRetries + 1} failed:`, error);
      
      // If we've reached max retries, give up
      if (retryCount >= maxRetries) {
        console.error('Max retries reached for processing:', error);
        
        // Update message state to error
        try {
          await supabase.from('messages')
            .update({ 
              processing_state: 'error',
              error_message: error.message || 'Processing failed after multiple attempts',
              updated_at: new Date().toISOString()
            })
            .eq('id', messageId);
        } catch (updateError) {
          console.error('Failed to update message error state:', updateError);
        }
        
        return {
          success: false,
          message: `Failed to process message after ${maxRetries + 1} attempts`,
          retryCount: retryCount + 1
        };
      }
      
      // Wait before retrying (exponential backoff)
      const delay = Math.pow(2, retryCount) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      retryCount++;
    }
  }
  
  // This should never be reached due to the return in the catch block
  return {
    success: false,
    message: "Unexpected error in process flow",
    retryCount
  };
}

/**
 * Reanalyze message caption
 */
export async function reanalyzeMessageCaption(message: Message): Promise<RepairResult> {
  try {
    console.log('Requesting direct analysis for message:', message.id);
    
    // Validate required fields
    if (!message.id) {
      throw new Error('Message ID is required for analysis');
    }
    
    if (!message.caption) {
      throw new Error('Message caption is required for analysis');
    }
    
    // Generate a correlation ID as a string
    const correlationId = crypto.randomUUID();
    
    // Log analysis start
    console.log(`Starting analysis for message ${message.id} with correlation ID ${correlationId}`);
    
    // Call parse-caption-with-ai directly for immediate processing
    const { data: analysisData, error: analysisError } = await supabase.functions.invoke(
      'parse-caption-with-ai',
      {
        body: { 
          messageId: message.id, 
          caption: message.caption,
          media_group_id: message.media_group_id,
          correlationId, 
          isEdit: false,
          retryCount: 0
        }
      }
    );
    
    if (analysisError) {
      throw new Error(analysisError.message || 'Analysis failed');
    }
    
    // If this is part of a media group, force sync the content to other messages immediately
    if (message.media_group_id) {
      try {
        const { data: syncData, error: syncError } = await supabase.functions.invoke(
          'xdelo_sync_media_group',
          {
            body: {
              mediaGroupId: message.media_group_id,
              sourceMessageId: message.id,
              correlationId,
              forceSync: true,
              syncEditHistory: true
            }
          }
        );
        
        if (syncError) {
          console.warn('Media group sync warning:', syncError);
        }
      } catch (syncError) {
        console.warn('Media group sync error (non-fatal):', syncError);
      }
    }
    
    return {
      success: true,
      message: 'The message has been analyzed successfully.'
    };
  } catch (error: any) {
    console.error('Error analyzing message:', error);
    
    return {
      success: false,
      message: error.message || 'Failed to analyze message'
    };
  }
}
