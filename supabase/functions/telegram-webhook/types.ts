/**
 * types.ts
 * 
 * Type definitions for Telegram webhook functionality
 */

// Basic Telegram message structure
export interface TelegramMessage {
  message_id: number;
  from?: {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
  };
  chat: {
    id: number;
    type: 'private' | 'group' | 'supergroup' | 'channel';
    title?: string;
    username?: string;
    first_name?: string;
    last_name?: string;
  };
  date: number;
  forward_date?: number;
  forward_from?: {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
  };
  forward_from_chat?: {
    id: number;
    type: 'private' | 'group' | 'supergroup' | 'channel';
    title?: string;
    username?: string;
  };
  forward_from_message_id?: number;
  forward_origin?: {
    type: string;
    date?: number;
    chat?: {
      id: number;
      type: 'private' | 'group' | 'supergroup' | 'channel';
      title?: string;
      username?: string;
    };
    message_id?: number;
  };
  text?: string;
  caption?: string;
  photo?: Array<{
    file_id: string;
    file_unique_id: string;
    file_size: number;
    width: number;
    height: number;
  }>;
  video?: {
    file_id: string;
    file_unique_id: string;
    width: number;
    height: number;
    duration: number;
    thumb?: {
      file_id: string;
      file_unique_id: string;
      file_size: number;
      width: number;
      height: number;
    };
    file_name?: string;
    mime_type?: string;
    file_size?: number;
  };
  document?: {
    file_id: string;
    file_unique_id: string;
    file_name?: string;
    mime_type?: string;
    file_size?: number;
    thumb?: {
      file_id: string;
      file_unique_id: string;
      file_size: number;
      width: number;
      height: number;
    };
  };
  media_group_id?: string;
  edit_date?: number;
}

// Telegram update structure
export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
}

// Webhook request structure
export interface WebhookRequest {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
}
