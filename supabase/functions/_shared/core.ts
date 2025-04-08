
import { supabaseClient } from './supabase.ts';

/**
 * Check if a message with the given ID exists in the database
 */
export async function checkMessageExists(messageId: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseClient
      .from('messages')
      .select('id')
      .eq('id', messageId)
      .single();
      
    if (error) {
      console.error('Error checking if message exists:', error);
      return false;
    }
    
    return !!data;
  } catch (error) {
    console.error('Exception checking if message exists:', error);
    return false;
  }
}

/**
 * Safely parse JSON string or return null if invalid
 */
export function safeJsonParse(jsonString: string | null | undefined): any | null {
  if (!jsonString) return null;
  
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.warn('Failed to parse JSON:', error);
    return null;
  }
}

/**
 * Generate a standardized filename for storing files
 */
export function generateStandardizedFilename(
  fileUniqueId: string, 
  mimeType: string, 
  chatId: string | number
): string {
  const timestamp = Date.now();
  const extension = mimeTypeToExtension(mimeType);
  return `${fileUniqueId}_${chatId}_${timestamp}${extension}`;
}

/**
 * Convert MIME type to file extension
 */
function mimeTypeToExtension(mimeType: string): string {
  const mimeMap: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'video/quicktime': '.mov',
    'application/pdf': '.pdf',
    'audio/mpeg': '.mp3',
    'audio/mp4': '.m4a',
    'audio/ogg': '.ogg'
  };
  
  return mimeMap[mimeType] || '.bin';
}
