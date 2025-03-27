
// Types for Make.com integrations

export enum MakeEventType {
  MESSAGE_RECEIVED = 'message_received',
  CHANNEL_JOINED = 'channel_joined',
  PRODUCT_CREATED = 'product_created',
  ORDER_UPDATED = 'order_updated',
  INVOICE_PAID = 'invoice_paid'
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
