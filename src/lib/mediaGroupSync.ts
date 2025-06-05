import { supabase } from '@/integrations/supabase/client';
import { safeRpcCall } from './rpcUtils';

/**
 * Maximum retries for media group synchronization
 */
const MAX_SYNC_RETRIES = 3;

/**
 * Interface for sync media group result
 */
interface SyncMediaGroupResult {
  success: boolean;
  mediaGroupId?: string;
  sourceMessageId?: string;
  syncedCount?: number;
  error?: string;
  retryCount?: number;
}

/**
 * Utility function to manually trigger media group synchronization
 * for a specific message or media group.
 * Updated to use the correct function signature and work with the database trigger approach.
 */
export async function syncMediaGroup(
  mediaGroupId: string,
  sourceMessageId?: string,
  options = { force: true }
): Promise<SyncMediaGroupResult> {
  try {
    console.log(`Manual media group sync initiated for group ${mediaGroupId}`);
    
    // If source message ID is not provided, try to find the best message
    if (!sourceMessageId) {
      const result = await safeRpcCall<string>(
        'xdelo_find_caption_message',
        { p_media_group_id: mediaGroupId }
      );
      
      if (!result.success || !result.data) {
        throw new Error(`Could not find caption message: ${result.error?.message || 'No suitable message found'}`);
      }
      
      sourceMessageId = result.data;
      
      if (!sourceMessageId) {
        throw new Error(`Could not find a suitable caption message in group ${mediaGroupId}`);
      }
      
      console.log(`Found source message ${sourceMessageId} for group ${mediaGroupId}`);
    }
    
    // Get the analyzed content from the source message
    const { data: sourceMessage, error: sourceError } = await supabase
      .from('messages')
      .select('analyzed_content')
      .eq('id', sourceMessageId)
      .single();
      
    if (sourceError || !sourceMessage?.analyzed_content) {
      throw new Error(`Could not get analyzed content from source message: ${sourceError?.message || 'No analyzed content'}`);
    }
    
    // Generate correlation ID for tracing
    const correlationId = crypto.randomUUID().toString();
    
    // Call the RPC function with the correct parameters
    const result = await safeRpcCall<{
      success: boolean;
      updated_count?: number;
      [key: string]: any;
    }>(
      'xdelo_sync_media_group_content',
      {
        p_message_id: sourceMessageId,
        p_analyzed_content: sourceMessage.analyzed_content,
        p_force_sync: options.force,
        p_sync_edit_history: true
      },
      {
        maxRetries: MAX_SYNC_RETRIES,
        onRetry: (attempt, error) => {
          console.log(`Retry attempt ${attempt} for media group ${mediaGroupId} sync: ${error.message}`);
        }
      }
    );
    
    if (!result.success) {
      throw new Error(`Media group sync failed: ${result.error?.message || 'Unknown error'}`);
    }
    
    console.log('Media group sync result:', result.data);
    
    return {
      success: true,
      mediaGroupId,
      sourceMessageId,
      syncedCount: result.data?.updated_count || 0,
      retryCount: result.retryCount
    };
    
  } catch (error: any) {
    console.error('Error in manual media group sync:', error);
    return {
      success: false,
      mediaGroupId,
      sourceMessageId,
      error: error.message,
      retryCount: error.retryCount
    };
  }
}

/**
 * Batch repair multiple media groups that might have sync issues.
 * Refactored for better error handling and reporting.
 */
export async function repairMediaGroups(limit = 10): Promise<{
  success: boolean;
  repaired: number;
  details?: any[];
  message?: string;
  error?: string;
}> {
  try {
    // Find media groups that need repair
    const { data: mediaGroups, error: findError } = await supabase
      .from('messages')
      .select('media_group_id')
      .not('media_group_id', 'is', null)
      .filter('group_caption_synced', 'is', null)
      .limit(limit);
    
    if (findError) {
      throw new Error(`Failed to find media groups: ${findError.message}`);
    }
    
    if (!mediaGroups || mediaGroups.length === 0) {
      return {
        success: true,
        repaired: 0,
        message: "No media groups need repair"
      };
    }
    
    // Get unique media group IDs
    const uniqueGroups = [...new Set(mediaGroups.map(m => m.media_group_id))];
    
    // Repair each media group
    const results = [];
    let repairedCount = 0;
    let attemptedCount = 0;
    
    for (const groupId of uniqueGroups) {
      try {
        attemptedCount++;
        const result = await syncMediaGroup(groupId);
        
        if (result.success) {
          repairedCount++;
        }
        
        results.push(result);
        
        // Add a small delay between operations to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error: any) {
        results.push({
          media_group_id: groupId,
          success: false,
          error: error.message
        });
      }
      
      // If we've reached a certain number of failures, stop processing
      const failedCount = attemptedCount - repairedCount;
      if (failedCount > 5 && failedCount / attemptedCount > 0.5) {
        console.error(`Stopping media group repair due to high failure rate: ${failedCount}/${attemptedCount}`);
        break;
      }
    }
    
    return {
      success: true,
      repaired: repairedCount,
      details: results,
      message: `Repaired ${repairedCount} of ${uniqueGroups.length} media groups`
    };
    
  } catch (error: any) {
    console.error('Error repairing media groups:', error);
    return {
      success: false,
      repaired: 0,
      error: error.message
    };
  }
}

export async function fetchMediaGroupMessages(
  mediaGroupId: string
): Promise<Message[]> {
  if (!mediaGroupId) {
    throw new Error('Media group ID is required');
  }
  
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('media_group_id', mediaGroupId)
      .order('created_at', { ascending: true });
      
    if (error) {
      throw new Error(`Failed to fetch media group: ${error.message}`);
    }
    
    return data || [];
  } catch (err) {
    console.error('Error in fetchMediaGroupMessages:', err);
    return [];
  }
}

export async function identifySourceCaption(mediaGroupId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('id')
      .eq('media_group_id', mediaGroupId)
      .eq('is_original_caption', true)
      .limit(1)
      .single();
      
    if (error || !data) {
      return null;
    }
    
    // Safely convert the result to string
    return typeof data.id === 'string' ? data.id : String(data.id);
  } catch (error) {
    console.error('Error identifying source caption:', error);
    return null;
  }
}
