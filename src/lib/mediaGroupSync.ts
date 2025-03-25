
import { supabase } from '@/integrations/supabase/client';
import { 
  processMessageCaption, 
  syncMediaGroup,
  scheduleDelayedSync 
} from './unifiedProcessor';

/**
 * Process a media group's content synchronization after a delay
 * 
 * @param mediaGroupId Media group ID to sync
 * @param messageId A message in the group to use for reference
 * @returns Result of the operation
 */
export async function processDelayedMediaGroupSync(
  mediaGroupId: string,
  messageId: string
): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  return scheduleDelayedSync(messageId, mediaGroupId);
}

/**
 * Find the caption source in a media group
 * 
 * @param mediaGroupId Media group ID
 * @returns ID of the message containing the caption, or null if none found
 */
export async function findCaptionMessageInGroup(
  mediaGroupId: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('xdelo_find_caption_message', {
      p_media_group_id: mediaGroupId
    });
    
    if (error || !data) {
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error finding caption message:', error);
    return null;
  }
}
