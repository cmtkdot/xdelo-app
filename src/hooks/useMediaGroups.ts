import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Message } from "@/types";

export const useMediaGroups = () => {
  return useQuery({
    queryKey: ['media-groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group messages by media_group_id
      const groupedMessages = (data || []).reduce((groups: { [key: string]: Message[] }, message) => {
        const groupId = message.media_group_id || message.id;
        if (!groups[groupId]) {
          groups[groupId] = [];
        }
        groups[groupId].push(message as Message);
        return groups;
      }, {});

      return groupedMessages;
    },
    initialData: {} // Provide empty object as initial data
  });
};
