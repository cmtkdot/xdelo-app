
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

// Additional types needed by the application

export interface MakeWebhookLog {
  id: string;
  webhook_id: string;
  event_type: string;
  request_payload: any;
  response_status: number;
  response_body: string;
  success: boolean;
  error_message?: string;
  created_at: string;
}

export interface MakeAutomationRule {
  id: string;
  name: string;
  description?: string;
  event_type: string;
  conditions: MakeCondition[];
  actions: MakeAction[];
  is_active: boolean;
  execution_order: number;
  created_at: string;
  updated_at: string;
}

export interface MakeCondition {
  id: string;
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than' | 'exists' | 'not_exists';
  value: any;
  group?: string;
  logic_operator?: 'and' | 'or';
}

export interface MakeAction {
  id: string;
  type: 'webhook' | 'email' | 'database' | 'custom';
  config: Record<string, any>;
  order: number;
}
