import { Message, AnalyzedContent } from "@/types";

export interface MediaItem {
  id: string;
  public_url: string;
  mime_type?: string;
  created_at: string;
  analyzed_content?: AnalyzedContent;
}

export function messageToMediaItem(message: Message): MediaItem {
  return {
    id: message.id,
    public_url: message.public_url || '',
    mime_type: message.mime_type || undefined,
    created_at: message.created_at || new Date().toISOString(),
    analyzed_content: message.analyzed_content,
  };
}

export interface MediaViewerProps {
  publicUrl: string;
  mimeType: string;
  caption?: string;
  className?: string;
}
