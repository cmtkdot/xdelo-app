import { Message } from '@/types/MessagesTypes';
import { SearchField } from '@/types/publicGallery/SearchTypes';

/**
 * Checks if a message matches the search term by examining analyzed_content fields
 * @param message The message to check
 * @param searchTerm The search term
 * @param searchFields Optional array of fields to search within
 * @returns boolean indicating if the message matches
 */
export const messageMatchesSearch = (
  message: Message, 
  searchTerm: string,
  searchFields?: SearchField[]
): boolean => {
  if (!searchTerm.trim()) return true;

  const lowerTerm = searchTerm.toLowerCase().trim();
  const content = message.analyzed_content;
  
  // If searchFields is provided, only check those specific fields
  if (searchFields && searchFields.length > 0) {
    return searchFields.some(field => {
      if (field === 'caption') {
        return message.caption?.toLowerCase().includes(lowerTerm);
      }
      return content?.[field]?.toString().toLowerCase().includes(lowerTerm);
    });
  }
  
  // Otherwise check all fields
  // Check product name
  if (content?.product_name && 
      content.product_name.toString().toLowerCase().includes(lowerTerm)) {
    return true;
  }
  
  // Check product code
  if (content?.product_code && 
      content.product_code.toString().toLowerCase().includes(lowerTerm)) {
    return true;
  }
  
  // Check vendor UID
  if (content?.vendor_uid && 
      content.vendor_uid.toString().toLowerCase().includes(lowerTerm)) {
    return true;
  }
  
  // Check notes
  if (content?.notes && 
      content.notes.toString().toLowerCase().includes(lowerTerm)) {
    return true;
  }
  
  // Check caption in analyzed_content
  if (content?.caption && 
      content.caption.toString().toLowerCase().includes(lowerTerm)) {
    return true;
  }
  
  // Check message caption
  if (message.caption && 
      message.caption.toLowerCase().includes(lowerTerm)) {
    return true;
  }
  
  return false;
};

/**
 * Filter an array of messages based on a search term
 * @param messages Array of messages to filter
 * @param searchTerm The search term
 * @param searchFields Optional array of fields to search within
 * @returns Filtered array of messages
 */
export const filterMessagesBySearchTerm = (
  messages: Message[], 
  searchTerm: string,
  searchFields?: SearchField[]
): Message[] => {
  if (!searchTerm.trim()) return messages;
  
  return messages.filter(message => 
    messageMatchesSearch(message, searchTerm, searchFields)
  );
};
