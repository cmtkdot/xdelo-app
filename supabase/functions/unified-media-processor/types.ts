export type ProcessingState = 
  | 'initialized'
  | 'waiting_caption'
  | 'has_caption'
  | 'processing_caption'
  | 'completed'
  | 'ready_for_sync'
  | 'error';

export interface MediaMessage {
  message_id: number;
  media_group_id?: string;
  caption?: string;
  photo?: any[];
  video?: any;
  document?: any;
  chat: {
    id: number;
    type: string;
  };
}

export interface MediaItem {
  file_id: string;
  file_unique_id: string;
  mime_type?: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
}