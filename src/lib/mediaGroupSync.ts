
import { supabase } from '@/integrations/supabase/client';
import { Message } from '@/types/entities/Message';
import { useToast } from '@/hooks/useToast';

export async function getMediaGroupMessages(mediaGroupId: string): Promise<Message[]> {
  if (!mediaGroupId) return [];
  
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('media_group_id', mediaGroupId)
    .order('created_at');
    
  if (error) {
    console.error('Error fetching media group messages:', error);
    return [];
  }
  
  return data as unknown as Message[];
}

export async function syncMediaGroupCaptions(mediaGroupId: string, sourceMessageId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('xdelo_sync_media_group_content', {
      p_source_message_id: sourceMessageId,
      p_media_group_id: mediaGroupId,
      p_correlation_id: crypto.randomUUID()
    });
    
    if (error) {
      console.error('Error syncing media group captions:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Exception syncing media group captions:', error);
    return false;
  }
}

// Schedule a delayed media group sync operation
export async function scheduleDelayedSync(messageId: string, mediaGroupId: string): Promise<boolean> {
  try {
    // Call the unified processor to schedule a delayed sync
    const { data, error } = await supabase.functions.invoke('xdelo_unified_processor', {
      body: {
        operation: 'delayed_sync',
        messageId,
        mediaGroupId,
        correlationId: crypto.randomUUID()
      }
    });
    
    if (error) {
      console.error('Error scheduling delayed sync:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Exception scheduling delayed sync:', error);
    return false;
  }
}
