
export interface MediaItem {
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
  analyzed_content?: any;
  created_at?: string;
  caption?: string;
  file_size?: number;
  content_disposition?: 'inline' | 'attachment';
  storage_path?: string;
  processing_state?: string;
}

export class MediaItem implements MediaItem {
  constructor(
    id: string,
    public_url: string,
    type: 'image' | 'video' | 'document' | 'audio' | 'unknown',
    options: Omit<MediaItem, 'id' | 'public_url' | 'type'> = {}
  ) {
    this.id = id;
    this.public_url = public_url;
    this.type = type;
    Object.assign(this, options);
  }

  static fromMessage(message: any): MediaItem {
    let type: 'image' | 'video' | 'document' | 'audio' | 'unknown' = 'unknown';
    
    if (message.mime_type) {
      if (message.mime_type.startsWith('image/')) {
        type = 'image';
      } else if (message.mime_type.startsWith('video/')) {
        type = 'video';
      } else if (message.mime_type.startsWith('audio/')) {
        type = 'audio';
      } else if (message.mime_type.startsWith('application/')) {
        type = 'document';
      }
    }
    
    return new MediaItem(
      message.id,
      message.public_url,
      type,
      {
        thumbnail: type === 'image' ? message.public_url : undefined,
        width: message.width,
        height: message.height,
        title: message.analyzed_content?.product_name || message.caption,
        description: message.caption,
        mimeType: message.mime_type,
        fileSize: message.file_size,
        duration: message.duration,
        uploadedAt: message.created_at,
        // Include legacy fields
        mime_type: message.mime_type,
        file_unique_id: message.file_unique_id,
        analyzed_content: message.analyzed_content,
        created_at: message.created_at,
        caption: message.caption,
        file_size: message.file_size,
        content_disposition: message.content_disposition,
        storage_path: message.storage_path,
        processing_state: message.processing_state
      }
    );
  }
}
