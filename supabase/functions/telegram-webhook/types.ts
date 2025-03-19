
// Create the file if it doesn't exist or update it if it does
export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

export interface TelegramVideo {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  duration: number;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramDocument {
  file_id: string;
  file_unique_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  caption?: string;
  photo?: TelegramPhotoSize[];
  video?: TelegramVideo;
  document?: TelegramDocument;
  forward_from?: TelegramUser;
  forward_from_chat?: TelegramChat;
  forward_from_message_id?: number;
  forward_sender_name?: string;
  forward_date?: number;
  media_group_id?: string;
  edit_date?: number;
  [key: string]: any; // Allow for other fields that may be present
}

export interface MessageContext {
  correlationId: string;
  isEdit: boolean;
  isChannelPost: boolean;
  startTime: Date;
  botToken: string; // Add bot token to context
}

export interface FileInfo {
  file_id: string;
  file_unique_id: string;
  mime_type?: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
  storage_path?: string;
  public_url?: string;
}
