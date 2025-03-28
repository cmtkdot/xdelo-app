
import { supabase } from '@/integrations/supabase/client';

/**
 * Utility function to manually trigger media group synchronization
 * for a specific message or media group.
 * Updated to use the correct function signature.
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
    if (!sourceMessageId) {
      const { data: findResult, error: findError } = await supabase.rpc<string>(
        'xdelo_find_caption_message',
        { p_media_group_id: mediaGroupId }
      );
      
      if (findError) {
        throw new Error(`Could not find caption message: ${findError.message}`);
      }
      
      sourceMessageId = findResult;
      
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
    
    // Generate correlation ID
    const correlationId = crypto.randomUUID().toString();
    
    // Call the RPC function with the correct parameters
    const { data, error } = await supabase.rpc<{
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
      }
    );
    
    if (error) {
      throw new Error(`Media group sync failed: ${error.message}`);
    }
    
    console.log('Media group sync result:', data);
    
    return {
      success: true,
      mediaGroupId,
      sourceMessageId,
      syncedCount: data?.updated_count || 0
    };
    
  } catch (error: any) {
    console.error('Error in manual media group sync:', error);
    return {
      success: false,
      mediaGroupId,
      sourceMessageId,
      error: error.message
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
    
    for (const groupId of uniqueGroups) {
      try {
        const result = await syncMediaGroup(groupId);
        
        if (result.success) {
          repairedCount++;
        }
        
        results.push(result);
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
      repaired: repairedCount,
      details: results
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
