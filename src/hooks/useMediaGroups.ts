
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Message } from "@/types/MessagesTypes";

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

      // Cast the database results to Message type
      const typedMessages = (data || []).map(item => {
        const message: Message = {
          ...item,
          storage_path_standardized: item.storage_path_standardized as boolean | string,
          storage_exists: item.storage_exists as boolean | string
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
