
import { Message } from "@/types/entities/Message";
import { AnalyzedContent } from "@/types/utils/AnalyzedContent";
import { MediaItem } from "@/types/entities/MediaItem";

export { MediaItem };

export function messageToMediaItem(message: Message): MediaItem {
  return {
    id: message.id,
    public_url: message.public_url || '',
    mime_type: message.mime_type || '',
    file_unique_id: message.file_unique_id || '',
    created_at: message.created_at || new Date().toISOString(),
    analyzed_content: message.analyzed_content || undefined,
    caption: message.caption
  };
}
