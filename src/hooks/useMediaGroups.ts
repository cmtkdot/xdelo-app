
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

        // Early return if data is null or empty
        if (!data || data.length === 0) {
          console.log('No messages found, returning empty array');
          return [] as Message[][];
        }

        // Transform data into media groups with defensive programming
        const mediaGroups: Record<string, Message[]> = {};

        // Process each message with null checks and provide default values
        data.forEach((rawMessage: any) => {
          if (!rawMessage) return; // Skip null/undefined messages
          
          // Ensure required properties have fallback values
          const message: Message = {
            id: rawMessage.id || `missing-id-${Date.now()}-${Math.random().toString(36).substring(2)}`,
            file_unique_id: rawMessage.file_unique_id || `missing-file-id-${Date.now()}`,
            public_url: rawMessage.public_url || '/placeholder.svg',
            // Add other required fields with fallbacks as needed
            ...rawMessage
          };
          
          const groupId = message.media_group_id || `single-${message.id}`;
          
          if (!mediaGroups[groupId]) {
            mediaGroups[groupId] = [];
          }
          
          mediaGroups[groupId].push(message);
        });

        console.log('Created', Object.keys(mediaGroups).length, 'media groups');

        // Sort media groups - keep most recent first
        Object.values(mediaGroups).forEach(group => {
          if (!group || !Array.isArray(group)) return;
          
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
        
        console.log('Final message groups structure:', 
          messageGroups.length, 'groups with proper typing');
        
        // Return the array of message groups (Message[][]) 
        return messageGroups;
      } catch (error) {
        console.error('Error in useMediaGroups hook:', error);
        // Return empty array on error rather than empty object
        return [] as Message[][];
      }
    },
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}
