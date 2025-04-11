
// Define Make webhook related types

export enum MakeEventType {
  MESSAGE_RECEIVED = 'message_received',
  CHANNEL_JOINED = 'channel_joined',
  USER_REGISTERED = 'user_registered',
  ORDER_CREATED = 'order_created',
  PAYMENT_PROCESSED = 'payment_processed',
  ITEM_SHIPPED = 'item_shipped',
  PRODUCT_CREATED = 'product_created',
  MEDIA_UPLOADED = 'media_uploaded',
  ANALYSIS_COMPLETED = 'analysis_completed',
  SYSTEM_EVENT = 'system_event'
}

export interface FieldSelectionConfig {
  include: boolean;
  transform?: string;
}

export interface MakeWebhookConfig {
  id: string;
  name: string;
  description: string;
  url: string;
  event_types: string[];
  is_active: boolean;
  field_selection: Record<string, FieldSelectionConfig> | null;
  payload_template: any | null;
  transformation_code: string | null;
  headers: Record<string, string> | null;
  retry_config: any | null;
  created_at: string;
  updated_at: string;
}

export interface TestPayload {
  id: string;
  name: string;
  description: string | null;
  event_type: string;
  payload: any;
  is_template: boolean;
  created_at: string;
  updated_at: string;
}
