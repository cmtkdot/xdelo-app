
import { supabase } from '@/integrations/supabase/client';
import { callUnifiedProcessor } from './unifiedProcessor';

/**
 * Utility function to manually trigger media group synchronization
 * for a specific message or media group
 */
export async function syncMediaGroup(
  mediaGroupId: string,
  sourceMessageId?: string,
  options = { force: true }
): Promise<{
  success: boolean;
  mediaGroupId: string;
  sourceMessageId?: string;
  syncedCount?: number;
  error?: string;
}> {
  try {
    console.log(`Manual media group sync initiated for group ${mediaGroupId}`);
    
    // If source message ID is not provided, try to find the best message
    // to use as the source of truth for this group
    if (!sourceMessageId) {
      const { data: findResult, error: findError } = await supabase.rpc<string>(
        'xdelo_find_caption_message',
        { p_media_group_id: mediaGroupId }
      );
      
      if (findError) {
        throw new Error(`Error finding caption message: ${findError.message}`);
      }
      
      sourceMessageId = findResult;
      
      if (!sourceMessageId) {
        throw new Error(`Could not find a suitable caption message in group ${mediaGroupId}`);
      }
      
      console.log(`Found source message ${sourceMessageId} for group ${mediaGroupId}`);
    }
    
    // Use the unified processor for syncing
    const result = await callUnifiedProcessor('sync_media_group', {
      messageId: sourceMessageId,
      mediaGroupId,
      force: options.force
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Media group sync failed');
    }
    
    console.log('Media group sync result:', result.data);
    
    // Extract the updated count from the result
    const updatedCount = result.data?.updated_count || 0;
    
    return {
      success: true,
      mediaGroupId,
      sourceMessageId,
      syncedCount: updatedCount
    };
    
  } catch (error: any) {
    console.error('Error in manual media group sync:', error);
    return {
      success: false,
      mediaGroupId,
      error: error.message
    };
  }
}

/**
 * Batch repair multiple media groups that might have sync issues
 */
export async function repairMediaGroups(limit = 10): Promise<{
  success: boolean;
  repaired?: number;
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
    
    // Repair each media group using the delayed sync operation
    const results = [];
    
    for (const groupId of uniqueGroups) {
      try {
        // Use the delayed sync operation which automatically finds the best source message
        const result = await callUnifiedProcessor('delayed_sync', {
          messageId: 'auto-detect', // This will be ignored in the function
          mediaGroupId: groupId
        });
        
        results.push({
          media_group_id: groupId,
          success: result.success,
          synced_count: result.data?.updated_count || 0,
          error: result.error
        });
      } catch (error) {
        results.push({
          media_group_id: groupId,
          success: false,
          error: error.message
        });
      }
    }
    
    return {
      success: true,
      repaired: results.filter(r => r.success).length,
      details: results
    };
    
  } catch (error: any) {
    console.error('Error repairing media groups:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
