import { useMemo } from 'react';
import { Message } from '@/types';
import { isVideoMessage } from '@/utils/mediaUtils';

interface UseGalleryFiltersProps {
  messages: Message[];
  filter?: string;
  searchTerm?: string; 
}

export function useGalleryFilters({
  messages,
  filter = 'all',
  searchTerm = '' 
}: UseGalleryFiltersProps) {
  // Apply filters whenever messages or filter change
  const filteredMessages = useMemo(() => {
    // Guard against undefined/null messages
    if (!messages || !Array.isArray(messages)) {
      console.warn("useGalleryFilters received invalid messages:", messages);
      return [];
    }
    
    console.log(`Filtering ${messages.length} messages with filter: ${filter}`);
    let result = [...messages];
    
    // Apply media type filter
    if (filter === "images") {
      result = result.filter(m => m.mime_type?.startsWith('image/'));
    } else if (filter === "videos") {
      result = result.filter(m => isVideoMessage(m));
    } else if (filter === "audio") {
      result = result.filter(m => m.mime_type?.startsWith('audio/'));
    } else if (filter === "documents") {
      result = result.filter(m => 
        m.mime_type?.startsWith('application/') || 
        m.mime_type?.startsWith('text/')
      );
    } 
    // 'all' filter does not filter anything
    // Note: We deliberately don't use searchTerm here as it's handled at the query level now

    console.log(`Filter result: ${result.length} messages after applying '${filter}' filter`);
    return result;
  }, [messages, filter]); // searchTerm is deliberately excluded from dependencies

  // Group messages for gallery view
  const mediaGroups = useMemo(() => {
    if (!filteredMessages || !filteredMessages.length) {
      console.log("No filtered messages to group");
      return [];
    }

    console.log(`Grouping ${filteredMessages.length} filtered messages`);
    
    // Group messages by media_group_id, selecting a representative thumbnail
    const groups: Record<string, Message[]> = {};
    
    filteredMessages.forEach(message => {
      // Skip invalid messages
      if (!message || !message.id) {
        console.warn("Skipping invalid message in grouping");
        return;
      }
      
      if (message.media_group_id) {
        groups[message.media_group_id] = groups[message.media_group_id] || [];
        groups[message.media_group_id].push(message);
      } else {
        // For messages without a group, use the message ID as a key
        groups[message.id] = [message];
      }
    });
    
    const groupArray = Object.values(groups);
    console.log(`Created ${groupArray.length} media groups`);
    return groupArray;
  }, [filteredMessages]);

  return { filteredMessages, mediaGroups };
}
