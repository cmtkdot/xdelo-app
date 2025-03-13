
export interface MediaItem {
  id: string;
  url: string;
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
}

export class MediaItem implements MediaItem {
  constructor(
    id: string,
    url: string,
    type: 'image' | 'video' | 'document' | 'audio' | 'unknown',
    options: Omit<MediaItem, 'id' | 'url' | 'type'> = {}
  ) {
    this.id = id;
    this.url = url;
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
        uploadedAt: message.created_at
      }
    );
  }
}
