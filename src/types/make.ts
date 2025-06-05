
// Types for Make.com integrations

export enum MakeEventType {
  MESSAGE_RECEIVED = 'MESSAGE_RECEIVED',
  CHANNEL_JOINED = 'CHANNEL_JOINED',
  PRODUCT_CREATED = 'PRODUCT_CREATED',
  ORDER_UPDATED = 'ORDER_UPDATED',
  INVOICE_PAID = 'INVOICE_PAID',
  MEDIA_RECEIVED = 'MEDIA_RECEIVED',
  MESSAGE_EDITED = 'MESSAGE_EDITED',
  MESSAGE_DELETED = 'MESSAGE_DELETED',
  MEDIA_GROUP_RECEIVED = 'MEDIA_GROUP_RECEIVED',
  MESSAGE_FORWARDED = 'MESSAGE_FORWARDED',
  CAPTION_UPDATED = 'CAPTION_UPDATED',
  PROCESSING_COMPLETED = 'PROCESSING_COMPLETED'
}

export interface MakeWebhookConfig {
  id: string;
  name: string;
  description: string | null;
  url: string;
  event_type: string;
  event_types?: string[]; // Added for backward compatibility
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
