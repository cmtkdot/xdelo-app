
import { Message } from "@/types/MessagesTypes";
import { AnalyzedContent, MediaItem } from "@/types";

export function messageToMediaItem(message: Message): MediaItem {
  return {
    id: message.id,
    public_url: message.public_url || '',
    mime_type: message.mime_type || undefined,
    file_unique_id: message.file_unique_id || '',
    created_at: message.created_at || new Date().toISOString(),
    analyzed_content: message.analyzed_content as AnalyzedContent || undefined,
  };
}
