
import { Message } from '@/types';
import { isVideoMessage } from '@/utils/mediaUtils';
import { useMemo } from 'react';

interface UseGalleryFiltersProps {
  messages: Message[];
  filter?: string;
}

export function useGalleryFilters({
  messages,
  filter = 'all'
}: UseGalleryFiltersProps) {
  // Apply filters whenever messages or filter change
  const filteredMessages = useMemo(() => {
    let result = [...messages];

    // Apply search filter if search term exists
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(msg =>
        (msg.caption && msg.caption.toLowerCase().includes(term))
      );
    }

    // Apply media type filter
    if (filter === "images") {
      result = result.filter(m => m.mime_type?.startsWith('image/'));
    } else if (filter === "videos") {
      // Use the same video detection logic as in PublicMediaCard
      result = result.filter(m => {
        return isVideoMessage(m) ||
          (m.public_url && (
            m.public_url.endsWith('.mp4') ||
            m.public_url.endsWith('.mov') ||
            m.public_url.endsWith('.webm') ||
            m.public_url.endsWith('.avi')
          ));
      });
    }

    return result;
  }, [messages, filter]);

  // Group messages for gallery view
  const mediaGroups = useMemo(() => {
    const groups: Record<string, Message[]> = {};

    // Step 1: Group messages by media_group_id
    filteredMessages.forEach(message => {
      if (message.media_group_id) {
        groups[message.media_group_id] = groups[message.media_group_id] || [];
        groups[message.media_group_id].push(message);
      } else {
        // For messages without a group, use the message ID as a key
        groups[message.id] = [message];
      }
    });

    // Step 2: For the "all" filter, only take the first image or video from each group
    // For other filters, keep all matching media items
    if (filter === 'all') {
      // Process groups to pick representative thumbnails
      const groupsWithThumbnails: Record<string, Message[]> = {};

      Object.entries(groups).forEach(([groupId, messages]) => {
        // First try to find an image as the representative thumbnail
        const thumbnail = messages.find(m => m.mime_type?.startsWith('image/')) || messages[0];

        if (thumbnail) {
          // Keep all messages in the group (for proper detail viewing) but only show one in the grid
          groupsWithThumbnails[groupId] = messages;
          // Mark the thumbnail message as the representative for this group
          // Using type assertion to modify the property since we know it exists in our custom Message type
          (thumbnail as Message & { isGroupThumbnail?: boolean }).isGroupThumbnail = true;
        }
      });

      return Object.values(groupsWithThumbnails);
    }

    // For specific media types (images/videos), return all matching messages by group
    return Object.values(groups);
  }, [filteredMessages, filter]);

  return { filteredMessages, mediaGroups };
}
