
/**
 * Types for Make integration
 */

export enum MakeEventType {
  MESSAGE_RECEIVED = 'message_received',
  MESSAGE_UPDATED = 'message_updated', 
  MEDIA_PROCESSED = 'media_processed',
  CHANNEL_JOINED = 'channel_joined',
  PRODUCT_CREATED = 'product_created',
  PRODUCT_UPDATED = 'product_updated',
  USER_ACTION = 'user_action',
  SYSTEM_EVENT = 'system_event'
}

export interface MakeWebhookConfig {
  id: string;
  name: string;
  description?: string;
  url: string;
  event_types: string[];
  is_active: boolean;
  field_selection?: Record<string, FieldSelectionConfig>;
  payload_template?: Record<string, any>;
  transformation_code?: string;
  headers?: Record<string, string>;
  retry_config?: RetryConfig;
  created_at?: string;
  updated_at?: string;
}

export interface FieldSelectionConfig {
  mode: 'include' | 'exclude';
  fields: string[];
}

export interface RetryConfig {
  max_attempts: number;
  backoff_factor: number;
  initial_delay_ms: number;
}

export interface MakeWebhookLog {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: any;
  response?: any;
  status: 'success' | 'failed' | 'pending';
  status_code?: number;
  attempt?: number;
  error_message?: string;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface MakeCondition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'starts_with' | 'ends_with' | 'exists' | 'not_exists';
  value: any;
}

export interface MakeAction {
  type: 'webhook' | 'email' | 'notification' | 'database' | 'function';
  config: Record<string, any>;
}

export interface MakeAutomationRule {
  id: string;
  name: string;
  description?: string;
  event_type: MakeEventType | string;
  conditions: MakeCondition[];
  actions: MakeAction[];
  is_active: boolean;
  priority: number;
  created_at?: string;
  updated_at?: string;
}
