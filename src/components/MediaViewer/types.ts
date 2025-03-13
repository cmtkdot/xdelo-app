
import { Message } from "@/types/MessagesTypes";
import { AnalyzedContent } from "@/types";

export interface MediaItem {
  id: string;
  public_url: string;
  mime_type: string;
  file_unique_id: string;
  created_at: string;
  analyzed_content?: AnalyzedContent;
  caption?: string;
}

export function messageToMediaItem(message: Message): MediaItem {
  return {
    id: message.id,
    public_url: message.public_url || '',
    mime_type: message.mime_type || '',
    file_unique_id: message.file_unique_id || '',
    created_at: message.created_at || new Date().toISOString(),
    analyzed_content: message.analyzed_content as AnalyzedContent || undefined,
    caption: message.caption
  };
}
