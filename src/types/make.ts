
// Types for Make.com integrations

export enum MakeEventType {
  MESSAGE_RECEIVED = 'message_received',
  CHANNEL_JOINED = 'channel_joined',
  PRODUCT_CREATED = 'product_created',
  ORDER_UPDATED = 'order_updated',
  INVOICE_PAID = 'invoice_paid',
  MEDIA_RECEIVED = 'media_received',
  MESSAGE_EDITED = 'message_edited',
  MESSAGE_DELETED = 'message_deleted',
  MEDIA_GROUP_RECEIVED = 'media_group_received',
  MESSAGE_FORWARDED = 'message_forwarded',
  CAPTION_UPDATED = 'caption_updated',
  PROCESSING_COMPLETED = 'processing_completed'
}

export interface MakeWebhookConfig {
  id: string;
  name: string;
  description: string | null;
  url: string;
  event_type: string;
  is_active: boolean;
  headers: Record<string, string> | null;
  retry_config: {
    max_attempts?: number;
    backoff_factor?: number;
    initial_delay?: number;
  } | null;
  field_selection: string[] | null;
  payload_template: Record<string, any> | null;
  transformation_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface MakeWebhookLog {
  id: string;
  webhook_id: string;
  request_body: Record<string, any>;
  response_body: Record<string, any> | null;
  status_code: number;
  error_message: string | null;
  created_at: string;
}

export interface MakeAutomationRule {
  id: string;
  name: string;
  description: string | null;
  event_type: MakeEventType | string;
  conditions: MakeCondition[];
  actions: MakeAction[];
  is_active: boolean;
  priority: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface MakeCondition {
  field: string;
  operator: string;
  value: any;
}

export interface MakeAction {
  type: string;
  config: Record<string, any>;
}
