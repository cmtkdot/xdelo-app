
import { supabase } from '@/integrations/supabase/client';

/**
 * Utility function to manually trigger media group synchronization
 * for a specific message or media group
 */
export async function syncMediaGroup(
  mediaGroupId: string,
  sourceMessageId?: string,
  options = { force: true }
) {
  try {
    console.log(`Manual media group sync initiated for group ${mediaGroupId}`);
    
    // If source message ID is not provided, try to find the best message
    // to use as the source of truth for this group
    if (!sourceMessageId) {
      const { data: findResult } = await supabase.rpc(
        'xdelo_find_caption_message',
        { p_media_group_id: mediaGroupId }
      );
      
      sourceMessageId = findResult;
      
      if (!sourceMessageId) {
        throw new Error(`Could not find a suitable caption message in group ${mediaGroupId}`);
      }
      
      console.log(`Found source message ${sourceMessageId} for group ${mediaGroupId}`);
    }
    
    // Generate correlation ID
    const correlationId = crypto.randomUUID().toString();
    
    // Call the database function directly instead of the edge function
    const { data, error } = await supabase.rpc(
      'xdelo_sync_media_group_content',
      {
        p_media_group_id: mediaGroupId,
        p_source_message_id: sourceMessageId,
        p_correlation_id: correlationId,
        p_force_sync: options.force,
        p_sync_edit_history: true
      }
    );
    
    if (error) {
      throw new Error(`Media group sync failed: ${error.message}`);
    }
    
    console.log('Media group sync result:', data);
    
    // Fixed: Properly handle the data response
    const result = {
      success: true,
      mediaGroupId,
      sourceMessageId,
      syncedCount: data && typeof data === 'object' ? (data.updated_count || 0) : 0
    };
    
    return result;
    
  } catch (error: any) {
    console.error('Error in manual media group sync:', error);
    throw error;
  }
}

/**
 * Batch repair multiple media groups that might have sync issues
 */
export async function repairMediaGroups(limit = 10) {
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
    
    for (const groupId of uniqueGroups) {
      try {
        const result = await syncMediaGroup(groupId);
        results.push({
          media_group_id: groupId,
          success: true,
          synced_count: result.syncedCount
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
