export interface TelegramMedia {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
  mime_type?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  channel_post?: TelegramMessage;
  my_chat_member?: TelegramChatMember;
}

export interface TelegramMessage {
  message_id: number;
  from?: {
    id: number;
    first_name: string;
    username?: string;
  };
  chat: {
    id: number;
    type: string;
    title?: string;
  };
  date: number;
  media_group_id?: string;
  caption?: string;
  photo?: TelegramMedia[];
  video?: TelegramMedia;
  document?: TelegramMedia;
}

export interface TelegramChatMember {
  chat: {
    id: number;
    title: string;
    type: string;
  };
  from: {
    id: number;
    is_bot: boolean;
    first_name: string;
    language_code?: string;
  };
  date: number;
  old_chat_member: {
    user: {
      id: number;
      is_bot: boolean;
      first_name: string;
      username?: string;
    };
    status: string;
  };
  new_chat_member: {
    user: {
      id: number;
      is_bot: boolean;
      first_name: string;
      username?: string;
    };
    status: string;
    [key: string]: any;
  };
}

export interface WebhookResponse {
  message: string;
  chat_id?: number;
  message_id?: number;
  status?: string;
  processed_media?: Array<{
    file_unique_id: string;
    public_url: string;
  }>;
}