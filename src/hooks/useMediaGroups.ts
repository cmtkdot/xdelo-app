
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
          caption: item.caption || undefined,
          file_id: item.file_id || undefined,
          storage_path: item.storage_path || undefined,
          mime_type: item.mime_type || undefined,
          file_size: item.file_size || undefined,
          width: item.width || undefined,
          height: item.height || undefined,
          user_id: item.user_id || undefined,
          processing_state: item.processing_state as ProcessingState || undefined,
          processing_started_at: item.processing_started_at || undefined,
          processing_completed_at: item.processing_completed_at || undefined,
          analyzed_content: item.analyzed_content ? JSON.parse(JSON.stringify(item.analyzed_content)) : {},
          telegram_data: item.telegram_data ? JSON.parse(JSON.stringify(item.telegram_data)) : {},
          error_message: item.error_message || undefined,
          chat_id: item.chat_id || undefined,
          chat_type: item.chat_type || undefined,
          chat_title: item.chat_title || undefined,
          created_at: item.created_at || '',
          updated_at: item.updated_at || undefined,
          is_original_caption: item.is_original_caption || false,
          group_caption_synced: item.group_caption_synced || false,
          storage_exists: Boolean(item.storage_exists),
          storage_path_standardized: Boolean(item.storage_path_standardized),
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
