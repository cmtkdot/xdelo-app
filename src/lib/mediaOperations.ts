
import { supabase } from '@/integrations/supabase/client'
import { Message } from '@/types'

export interface CaptionUpdatePayload {
  messageId: string
  newCaption: string
  mediaGroupId?: string
}

export interface CaptionUpdateResult {
  success: boolean
  message?: string
  error?: string
}

export async function updateMessageCaption(
  messageId: string,
  newCaption: string,
  mediaGroupId?: string
): Promise<CaptionUpdateResult> {
  try {
    // Call the database function to sync the caption
    const { data, error } = await supabase.rpc('x_sync_media_group_captions', {
      p_media_group_id: mediaGroupId,
      p_source_message_id: messageId,
      p_correlation_id: `caption_update_${Date.now()}`
    })

    if (error) {
      console.error('Error updating caption:', error)
      return {
        success: false,
        error: error.message
      }
    }

    // Then update the specific message caption
    const { error: updateError } = await supabase
      .from('messages')
      .update({ 
        caption: newCaption,
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId)

    if (updateError) {
      console.error('Error updating message caption:', updateError)
      return {
        success: false,
        error: updateError.message
      }
    }

    return {
      success: true,
      message: 'Caption updated successfully'
    }

  } catch (error) {
    console.error('Error in updateMessageCaption:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

export async function processMessageCaption(
  messageId: string,
  caption: string
): Promise<CaptionUpdateResult> {
  try {
    // This would call the caption processing workflow
    console.log('Processing caption for message:', messageId, caption)
    
    // For now, just return success - implement actual processing logic
    return {
      success: true,
      message: 'Caption processing initiated'
    }

  } catch (error) {
    console.error('Error in processMessageCaption:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}
