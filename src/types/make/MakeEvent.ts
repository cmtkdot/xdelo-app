
// Define event types for Make integrations
export enum MakeEventType {
  MESSAGE_RECEIVED = 'message_received',
  MEDIA_UPLOADED = 'media_uploaded', 
  PRODUCT_CREATED = 'product_created',
  INVOICE_CREATED = 'invoice_created',
  USER_REGISTERED = 'user_registered',
  CHANNEL_JOINED = 'channel_joined'
}

// Define webhook log structure
export interface MakeWebhookLog {
  id: string;
  webhook_id?: string;
  event_type: string;
  status: 'success' | 'failed' | 'pending';
  payload: any;
  response?: any;
  error_message?: string;
  tags?: string[];
  retry_count: number;
  created_at: string;
  updated_at: string;
}

// Define test payload interface
export interface MakeTestPayload {
  id: string;
  name: string;
  description: string | null;
  event_type: string;
  payload: any;
  is_template: boolean;
  created_at: string;
  updated_at: string;
}
