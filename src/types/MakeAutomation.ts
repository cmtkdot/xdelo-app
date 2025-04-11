
import { Json } from "@/integrations/supabase/types";

export type MakeEventType = 
  | 'message_received'
  | 'media_group_received'
  | 'message_deleted'
  | 'message_edited'
  | 'product_matched'
  | string;

export interface MakeAutomationRule {
  id: string;
  name: string;
  description: string;
  event_type: MakeEventType | string;
  conditions: Json;
  actions: Json;
  is_active: boolean;
  execution_order: number; // Added missing property
  created_at: string;
  updated_at: string;
}

export interface MakeWebhookConfig {
  id: string;
  name: string;
  description: string;
  url: string;
  event_types: string[];
  is_active: boolean;
  field_selection: Record<string, FieldSelectionConfig>;
  payload_template: Json;
  transformation_code: string;
  headers: Json;
  retry_config: Json;
  created_at: string;
  updated_at: string;
}

export interface FieldSelectionConfig {
  include: boolean;
  transform?: string;
}

export interface TestPayload {
  id: string;
  name: string;
  description: string;
  event_type: string;
  payload: Json;
  is_template: boolean;
  created_at: string;
  updated_at: string;
}
