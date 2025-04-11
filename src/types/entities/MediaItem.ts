
// Define the analyzed content structure based on the actual schema
export interface AnalyzedContent {
  product_name?: string;
  [key: string]: unknown;
}

// Base interface for media item properties
export interface MediaItemProps {
  id: string;
  public_url: string;
  type: 'image' | 'video' | 'document' | 'audio' | 'unknown';
  thumbnail?: string;
  width?: number;
  height?: number;
  title?: string;
  description?: string;
  mimeType?: string;
  fileSize?: number;
  duration?: number;
  uploadedAt?: string;
  // Also include legacy fields for compatibility
  mime_type?: string;
  file_unique_id?: string;
  analyzed_content?: AnalyzedContent;
  created_at?: string;
  caption?: string;
  file_size?: number;
  content_disposition?: 'inline' | 'attachment';
  storage_path?: string;
  processing_state?: string;
}

export class MediaItem implements MediaItemProps {
  constructor(
    id: string,
    public_url: string,
    type: 'image' | 'video' | 'document' | 'audio' | 'unknown',
    options: Omit<MediaItemProps, 'id' | 'public_url' | 'type'> = {}
  ) {
    this.id = id;
    this.public_url = public_url;
    this.type = type;
    Object.assign(this, options);
  }

  static fromMessage(message: Record<string, unknown>): MediaItem {
    let type: 'image' | 'video' | 'document' | 'audio' | 'unknown' = 'unknown';
    
    const mimeType = message.mime_type as string | undefined;
    if (mimeType) {
      if (mimeType.startsWith('image/')) {
        type = 'image';
      } else if (mimeType.startsWith('video/')) {
        type = 'video';
      } else if (mimeType.startsWith('audio/')) {
        type = 'audio';
      } else if (mimeType.startsWith('application/')) {
        type = 'document';
      }
    }
    
    return new MediaItem(
      message.id as string,
      message.public_url as string,
      type,
      {
        thumbnail: type === 'image' ? message.public_url as string : undefined,
        width: message.width as number | undefined,
        height: message.height as number | undefined,
        title: message.analyzed_content ? 
          (message.analyzed_content as AnalyzedContent).product_name || (message.caption as string | undefined) : 
          (message.caption as string | undefined),
        description: message.caption as string | undefined,
        mimeType: mimeType,
        fileSize: message.file_size as number | undefined,
        duration: message.duration as number | undefined,
        uploadedAt: message.created_at as string | undefined,
        // Include legacy fields
        mime_type: mimeType,
        file_unique_id: message.file_unique_id as string | undefined,
        analyzed_content: message.analyzed_content as AnalyzedContent | undefined,
        created_at: message.created_at as string | undefined,
        caption: message.caption as string | undefined,
        file_size: message.file_size as number | undefined,
        content_disposition: message.content_disposition as 'inline' | 'attachment' | undefined,
        storage_path: message.storage_path as string | undefined,
        processing_state: message.processing_state as string | undefined
      }
    );
  }
}
