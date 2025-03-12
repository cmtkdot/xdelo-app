
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Message, ProcessingState } from "@/types/MessagesTypes";

interface GroupedMessages {
  [key: string]: Message[];
}

export const useMediaGroups = () => {
  return useQuery({
    queryKey: ['media-groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_messages_compatibility')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Cast the database results to Message type with proper type handling
      const typedMessages = (data || []).map(item => {
        // Explicit typing to ensure all properties are properly handled
        const message: Message = {
          id: item.id || '',
          file_unique_id: item.file_unique_id || '',
          public_url: item.public_url || '',
          telegram_message_id: item.telegram_message_id || undefined,
          media_group_id: item.media_group_id || undefined,
          message_caption_id: item.message_caption_id || undefined,
          is_original_caption: item.is_original_caption || undefined,
          group_caption_synced: item.group_caption_synced || undefined,
          caption: item.caption || undefined,
          file_id: item.file_id || undefined,
          storage_path: item.storage_path || undefined,
          mime_type: item.mime_type || undefined,
          mime_type_verified: item.mime_type_verified || undefined,
          mime_type_original: item.mime_type_original || undefined,
          content_disposition: item.content_disposition as 'inline' | 'attachment' || undefined,
          storage_metadata: item.storage_metadata || undefined,
          file_size: item.file_size || undefined,
          width: item.width || undefined,
          height: item.height || undefined,
          duration: item.duration || undefined,
          user_id: item.user_id || undefined,
          processing_state: item.processing_state as ProcessingState || undefined,
          processing_started_at: item.processing_started_at || undefined,
          processing_completed_at: item.processing_completed_at || undefined,
          analyzed_content: item.analyzed_content || undefined,
          telegram_data: item.telegram_data as Record<string, unknown> || undefined,
          error_message: item.error_message || undefined,
          error_code: item.error_code || undefined,
          storage_exists: item.storage_exists,
          storage_path_standardized: item.storage_path_standardized,
          chat_id: item.chat_id || undefined,
          chat_type: item.chat_type || undefined,
          chat_title: item.chat_title || undefined,
          created_at: item.created_at || undefined,
          updated_at: item.updated_at || undefined,
          is_forward: item.is_forward || undefined,
          correlation_id: item.correlation_id || undefined
        };
        return message;
      });
      
      // Group messages by media_group_id
      const groupedMessages: GroupedMessages = typedMessages.reduce((groups, message) => {
        const groupId = message.media_group_id || message.id;
        if (!groups[groupId]) {
          groups[groupId] = [];
        }
        groups[groupId].push(message);
        
        // Sort messages within group to ensure consistent order
        groups[groupId].sort((a, b) => {
          if (a.is_original_caption && !b.is_original_caption) return -1;
          if (!a.is_original_caption && b.is_original_caption) return 1;
          return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime();
        });
        
        return groups;
      }, {} as GroupedMessages);

      console.log('Total groups:', Object.keys(groupedMessages).length);
      return groupedMessages;
    },
    staleTime: 1000,
    refetchOnWindowFocus: true,
    retry: 3
  });
};
