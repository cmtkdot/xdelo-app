
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
    const correlationId = crypto.randomUUID();
    
    // Trigger the sync operation
    const { data, error } = await supabase.functions.invoke(
      'xdelo_sync_media_group',
      {
        body: {
          mediaGroupId,
          sourceMessageId,
          correlationId,
          forceSync: options.force,
          syncEditHistory: true
        }
      }
    );
    
    if (error) {
      throw new Error(`Media group sync failed: ${error.message}`);
    }
    
    console.log('Media group sync result:', data);
    return data;
    
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
    const { data, error } = await supabase.rpc(
      'xdelo_repair_media_group_syncs'
    );
    
    if (error) {
      throw new Error(`Media group repair failed: ${error.message}`);
    }
    
    console.log('Media group repair results:', data);
    return {
      success: true,
      repaired: data?.length || 0,
      details: data
    };
    
  } catch (error: any) {
    console.error('Error repairing media groups:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
