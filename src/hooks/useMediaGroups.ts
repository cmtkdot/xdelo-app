
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Message } from "@/types";

export const useMediaGroups = () => {
  const { data, error, isLoading } = useQuery({
    queryKey: ['media-groups'],
    queryFn: async () => {
      const { data: rawData, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const messages = rawData as Message[];

      // Group messages by media_group_id
      const groupedMessages = messages.reduce((acc: { [key: string]: Message[] }, message) => {
        const groupId = message.media_group_id || message.id;
        if (!acc[groupId]) {
          acc[groupId] = [];
        }
        acc[groupId].push(message);
        return acc;
      }, {});

      // Convert to array and sort
      return Object.values(groupedMessages).map(group => 
        [...group].sort((a, b) => {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        })
      );
    }
  });

  return {
    data: data || [],
    error,
    isLoading
  };
};
