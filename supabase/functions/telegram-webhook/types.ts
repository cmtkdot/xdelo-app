
export interface MessageInput {
  telegram_message_id: number;
  chat_id: number;
  chat_type: string;
  chat_title?: string;
  caption?: string;
  media_group_id?: string;
  file_id: string;
  file_unique_id: string;
  mime_type?: string;
  mime_type_original?: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
  storage_path: string;
  public_url?: string;
  correlation_id: string;
  processing_state: string;
  telegram_data: any;
  forward_info?: ForwardInfo;
  is_edited_channel_post?: boolean;
  edit_date?: string;
  is_duplicate?: boolean;
  is_forward?: boolean;
  edit_history?: any[];
  storage_exists?: boolean;
  storage_path_standardized?: boolean;
}

export interface ForwardInfo {
  is_forwarded?: boolean;
  from_chat_id?: number;
  from_message_id?: number;
  from_chat_title?: string;
  forward_date?: string;
  forward_origin_type?: string;
  forward_from_chat_id?: number;
  forward_from_chat_title?: string;
  forward_from_chat_type?: string;
  forward_from_message_id?: number;
  original_chat_id?: number;
  original_chat_title?: string;
  original_message_id?: number;
}
