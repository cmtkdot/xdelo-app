
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Message, MediaItem } from "@/types";

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
      const groupedMessages = (messages as Message[]).reduce((groups: { [key: string]: MediaItem[][] }, message) => {
        if (!message.public_url) return groups; // Skip messages without media
        
        const groupId = message.media_group_id || message.id;
        if (!groups[groupId]) {
          groups[groupId] = [];
        }

        // Transform Message to MediaItem
        const mediaItem: MediaItem = {
          id: message.id,
          public_url: message.public_url,
          mime_type: message.mime_type,
          created_at: message.created_at || new Date().toISOString(),
          analyzed_content: message.analyzed_content || null,
          file_id: message.file_id,
          file_unique_id: message.file_unique_id,
          width: message.width,
          height: message.height,
          duration: message.duration,
          caption: message.caption
        };

        // Find the right group or create a new one
        const groupArray = groups[groupId];
        if (!groupArray.length) {
          groupArray.push([mediaItem]);
        } else {
          groupArray[0].push(mediaItem);
        }

        return groups;
      }, {});

      // Sort messages within each group
      Object.values(groupedMessages).forEach(groupArray => {
        groupArray.forEach(group => {
          group.sort((a, b) => {
            // First prioritize images over videos
            const aIsImage = !a.mime_type?.startsWith('video/');
            const bIsImage = !b.mime_type?.startsWith('video/');
            if (aIsImage && !bIsImage) return -1;
            if (!aIsImage && bIsImage) return 1;

            // Then prioritize messages with captions
            if (a.caption && !b.caption) return -1;
            if (!a.caption && b.caption) return 1;
            
            // Then by creation date
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });
        });
      });

      // Convert the grouped messages into arrays
      return Object.values(groupedMessages).flatMap(group => group);
    },
  });
};
