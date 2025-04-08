
import { MakeEventType } from './MakeEvent';

// Core webhook configuration
export interface MakeWebhookConfig {
  id: string;
  name: string;
  url: string;
  event_types: MakeEventType[];
  is_active: boolean;
  field_selection?: string[] | null;
  payload_template?: Record<string, any> | null;
  transformation_code?: string | null;
  headers?: Record<string, string> | null;
  retry_config?: WebhookRetryConfig | null;
  created_at: string;
  updated_at: string;
}

// Configuration for webhook retries
export interface WebhookRetryConfig {
  max_retries: number;
  retry_interval: number; // in seconds
  backoff_factor: number;
}
