
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';
import { Message } from '@/types/MessagesTypes';

export function useCaptionSync() {
  const [isSyncing, setIsSyncing] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  /**
   * Directly sync a message's caption and analyzed content to its media group
   */
  const syncMediaGroupContent = async (message: Message) => {
    if (!message?.id || isSyncing[message.id]) return;
    
    try {
      setIsSyncing(prev => ({ ...prev, [message.id]: true }));
      setErrors(prev => ({ ...prev, [message.id]: '' }));
      
      console.log(`Syncing media group content for message ${message.id}`, {
        media_group_id: message.media_group_id,
        has_caption: !!message.caption,
      });
      
      if (!message.media_group_id) {
        console.log('No media group ID, skipping group sync');
        return;
      }
      
      // Generate correlation ID
      const correlationId = crypto.randomUUID();
      
      // Use our new simplified edge function for media group sync
      const { data, error } = await supabase.functions.invoke(
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
      
      if (error) {
        throw new Error(`Media group sync failed: ${error.message}`);
      }
      
      console.log('Media group sync result:', data);
      
      toast({
        title: "Media Group Synced",
        description: `Successfully synced content to ${data?.synced_count || 0} related media`,
      });
      
      return data;
      
    } catch (error: any) {
      console.error('Error syncing media group:', error);
      
      const errorMessage = error.message || 'Failed to sync media group';
      setErrors(prev => ({ ...prev, [message.id]: errorMessage }));
      
      toast({
        title: "Sync Failed",
        description: errorMessage,
        variant: "destructive"
      });
      
    } finally {
      setIsSyncing(prev => ({ ...prev, [message.id]: false }));
    }
  };

  /**
   * Process a caption update and ensure content is synchronized
   */
  const processCaptionUpdate = async (message: Message, newCaption: string) => {
    if (!message?.id || isSyncing[message.id]) return;
    
    try {
      setIsSyncing(prev => ({ ...prev, [message.id]: true }));
      
      // First update the caption
      const { error: updateError } = await supabase
        .from('messages')
        .update({ 
          caption: newCaption,
          updated_at: new Date().toISOString(),
          // Reset these fields to ensure they get properly processed
          analyzed_content: null,
          processing_state: 'pending',
          group_caption_synced: false,
          is_original_caption: true
        })
        .eq('id', message.id);
      
      if (updateError) {
        throw new Error(`Failed to update caption: ${updateError.message}`);
      }
      
      // Then trigger analysis and sync
      const correlationId = crypto.randomUUID();
      
      // Directly invoke the manual-caption-parser for immediate processing
      const { data: parsingData, error: parsingError } = await supabase.functions.invoke(
        'manual-caption-parser',
        {
          body: {
            messageId: message.id,
            caption: newCaption,
            media_group_id: message.media_group_id,
            correlationId,
            isEdit: true,
            trigger_source: 'caption_edit_ui'
          }
        }
      );
      
      if (parsingError) {
        throw new Error(`Failed to analyze caption: ${parsingError.message}`);
      }
      
      // Create a new message object with the updated caption
      const updatedMessage = {
        ...message,
        caption: newCaption,
        is_original_caption: true,
        processing_state: 'completed'
      };
      
      // Explicitly sync to media group with a small delay 
      // to ensure the analysis has completed
      if (message.media_group_id) {
        // Short timeout to ensure analysis is complete
        setTimeout(async () => {
          try {
            await syncMediaGroupContent(updatedMessage as Message);
          } catch (syncError) {
            console.error('Delayed sync error:', syncError);
          }
        }, 1000);
      }
      
      toast({
        title: "Caption Updated",
        description: "Caption updated and content synchronized."
      });
      
      return {
        analysis: parsingData,
        success: true
      };
      
    } catch (error: any) {
      console.error('Error processing caption update:', error);
      
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update caption",
        variant: "destructive"
      });
      
      return {
        success: false,
        error: error.message
      };
      
    } finally {
      setIsSyncing(prev => ({ ...prev, [message.id]: false }));
    }
  };

  /**
   * Force synchronization for a message that may have been missed
   */
  const forceSyncMessageGroup = async (messageId: string) => {
    try {
      // First get the message details
      const { data: message, error: fetchError } = await supabase
        .from('messages')
        .select('*')
        .eq('id', messageId)
        .single();
      
      if (fetchError || !message) {
        throw new Error(`Failed to fetch message: ${fetchError?.message || 'Message not found'}`);
      }
      
      // Then trigger a forced sync
      return await syncMediaGroupContent(message as Message);
      
    } catch (error: any) {
      console.error('Error in force sync:', error);
      
      toast({
        title: "Force Sync Failed",
        description: error.message || "Failed to force sync message",
        variant: "destructive"
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  };

  return {
    syncMediaGroupContent,
    processCaptionUpdate,
    forceSyncMessageGroup,
    isSyncing,
    errors
  };
}
