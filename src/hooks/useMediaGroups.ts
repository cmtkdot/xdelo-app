
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Message, ProcessingState, AnalyzedContent } from "@/types";
import { logEvent, LogEventType } from "@/lib/logUtils";

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
        // Create a safely typed message object from the raw data
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
          processing_state: (item.processing_state as ProcessingState) || undefined,
          processing_started_at: item.processing_started_at || undefined,
          processing_completed_at: item.processing_completed_at || undefined,
          analyzed_content: item.analyzed_content as AnalyzedContent || undefined,
          telegram_data: item.telegram_data as Record<string, unknown> || {},
          error_message: item.error_message || undefined,
          chat_id: item.chat_id || undefined,
          chat_type: item.chat_type || undefined,
          chat_title: item.chat_title || undefined,
          created_at: item.created_at || '',
          updated_at: item.updated_at || undefined,
          is_original_caption: item.is_original_caption || false,
          group_caption_synced: item.group_caption_synced || false,
        };

        // Handle properties that might not be in the type definition
        if ('storage_exists' in item) {
          (message as any).storage_exists = typeof item.storage_exists === 'boolean' 
            ? item.storage_exists 
            : Boolean(item.storage_exists);
        }
        
        if ('storage_path_standardized' in item) {
          (message as any).storage_path_standardized = typeof item.storage_path_standardized === 'boolean'
            ? item.storage_path_standardized
            : Boolean(item.storage_path_standardized);
        }
        
        return message;
      });
      
      try {
        // Log the media groups fetch operation
        await logEvent(
          LogEventType.MEDIA_GROUP_FETCH,
          'media-groups-query',
          {
            messageCount: typedMessages.length,
            timestamp: new Date().toISOString()
          }
        );
      } catch (logError) {
        console.error("Error logging media group fetch:", logError);
      }
      
      // Group messages by media_group_id with validation
      const groupedMessages: GroupedMessages = {};
      
      typedMessages.forEach(message => {
        // Determine the correct group identifier
        // Use media_group_id if it exists and is valid, otherwise use message.id as fallback
        const groupId = message.media_group_id && message.media_group_id.trim() !== '' 
          ? message.media_group_id 
          : message.id;
          
        if (!groupedMessages[groupId]) {
          groupedMessages[groupId] = [];
        }
        
        // Ensure we don't add duplicate messages to the same group
        const isDuplicate = groupedMessages[groupId].some(m => m.id === message.id);
        if (!isDuplicate) {
          groupedMessages[groupId].push(message);
        }
      });
      
      // Sort messages within each group for consistent display
      Object.keys(groupedMessages).forEach(groupId => {
        // First, prioritize messages with original captions
        groupedMessages[groupId].sort((a, b) => {
          // First priority: is_original_caption flag
          if (a.is_original_caption && !b.is_original_caption) return -1;
          if (!a.is_original_caption && b.is_original_caption) return 1;
          
          // Second priority: has caption
          const aHasCaption = !!a.caption;
          const bHasCaption = !!b.caption;
          if (aHasCaption && !bHasCaption) return -1;
          if (!aHasCaption && bHasCaption) return 1;
          
          // Third priority: has analyzed content
          const aHasAnalyzedContent = !!a.analyzed_content;
          const bHasAnalyzedContent = !!b.analyzed_content;
          if (aHasAnalyzedContent && !bHasAnalyzedContent) return -1;
          if (!aHasAnalyzedContent && bHasAnalyzedContent) return 1;
          
          // Last resort: sort by date (newest first)
          return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime();
        });
      });

      return groupedMessages;
    },
    staleTime: 60000, // 1 minute stale time for better performance
    refetchOnWindowFocus: true,
    retry: 3
  });
};
