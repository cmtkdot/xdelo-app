
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Message } from "@/types";

export const useMediaGroups = () => {
  return useQuery({
    queryKey: ['media-groups'],
    queryFn: async () => {
      const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group messages by media_group_id or message id if no group
      const groupedMessages = (messages as Message[]).reduce((groups: { [key: string]: Message[] }, message) => {
        const groupId = message.media_group_id || message.id;
        if (!groups[groupId]) {
          groups[groupId] = [];
        }
        groups[groupId].push(message);
        return groups;
      }, {});

      // Sort messages within each group
      Object.values(groupedMessages).forEach(group => {
        group.sort((a, b) => {
          // Prioritize messages with captions
          if (a.caption && !b.caption) return -1;
          if (!a.caption && b.caption) return 1;
          
          // Then by creation date
          return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime();
        });
      });

      return groupedMessages;
    },
  });
};
