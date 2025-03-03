
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Message } from "@/types";

export const useMediaGroups = () => {
  return useQuery({
    queryKey: ['media-groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_messages_compatibility')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group messages by media_group_id
      const groupedMessages = (data || []).reduce((groups: { [key: string]: Message[] }, message) => {
        // Use media_group_id if available, otherwise use message id as the group key
        const groupId = message.media_group_id || message.id;
        if (!groups[groupId]) {
          groups[groupId] = [];
        }
        groups[groupId].push(message as Message);
        
        // Sort messages within group to ensure consistent order
        // Put messages with original captions first
        groups[groupId].sort((a, b) => {
          if (a.is_original_caption && !b.is_original_caption) return -1;
          if (!a.is_original_caption && b.is_original_caption) return 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        
        return groups;
      }, {});

      console.log('Total groups:', Object.keys(groupedMessages).length);
      return groupedMessages;
    },
    staleTime: 1000, // Consider data fresh for 1 second
    refetchOnWindowFocus: true,
    retry: 3
  });
};
