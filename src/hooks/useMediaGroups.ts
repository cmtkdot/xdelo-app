
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Message } from '@/types';

export function useMediaGroups() {
  return useQuery({
    queryKey: ['media-groups'],
    queryFn: async () => {
      try {
        console.log('Fetching media groups...');
        const { data, error } = await supabase
          .from('v_messages_compatibility')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(500);

        if (error) {
          console.error('Error fetching media groups:', error);
          throw error;
        }

        console.log('Received data:', data?.length || 0, 'messages');

        // Transform data into media groups with defensive programming
        const mediaGroups: Record<string, Message[]> = {};

        // Process each message with null checks
        (data || []).forEach((message: any) => {
          if (!message) return; // Skip null/undefined messages
          
          const groupId = message.media_group_id || `single-${message.id}`;
          
          if (!mediaGroups[groupId]) {
            mediaGroups[groupId] = [];
          }
          
          mediaGroups[groupId].push(message as Message);
        });

        console.log('Created', Object.keys(mediaGroups).length, 'media groups');

        // Sort media groups - keep most recent first
        Object.values(mediaGroups).forEach(group => {
          group.sort((a, b) => {
            // If we have telegram_message_id, sort by that
            if (a.telegram_message_id && b.telegram_message_id) {
              return a.telegram_message_id - b.telegram_message_id;
            }
            
            // Otherwise sort by created_at
            const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return dateA - dateB;
          });
        });

        // Convert the record to an array of arrays for MessageGridView
        const messageGroups: Message[][] = Object.values(mediaGroups);
        
        // Return the array of message groups (Message[][]) 
        // instead of the object for proper typing
        return messageGroups;
      } catch (error) {
        console.error('Error in useMediaGroups hook:', error);
        // Return empty array on error rather than throwing or empty object
        return [];
      }
    },
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}
