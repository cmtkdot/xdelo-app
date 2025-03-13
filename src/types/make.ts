
export enum MakeEventType {
  MessageReceived = 'message_received',
  ChannelJoined = 'channel_joined',
  ChannelLeft = 'channel_left',
  UserJoined = 'user_joined',
  UserLeft = 'user_left',
  MediaReceived = 'media_received',
  CommandReceived = 'command_received',
  // New Telegram-specific event types
  MessageEdited = 'message_edited',
  MessageDeleted = 'message_deleted',
  MediaGroupReceived = 'media_group_received',
  MessageForwarded = 'message_forwarded',
  CaptionUpdated = 'caption_updated',
  ProcessingCompleted = 'processing_completed'
}

export interface MakeCondition {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan';
  value: string | number | boolean;
}

export interface MakeAction {
  type: string;
  config: Record<string, any>;
}

export interface MakeAutomationRule {
  id: string;
  name: string;
  description?: string | null;
  event_type: MakeEventType | string;
  conditions: MakeCondition[];
  actions: MakeAction[];
  is_active: boolean | null;
  priority: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface MakeWebhookConfig {
  id: string;
  name: string;
  description?: string | null;
  url: string;
  event_types: string[];
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  field_selection?: Record<string, any> | null;
  payload_template?: Record<string, any> | null;
  transformation_code?: string | null;
  headers?: Record<string, string> | null;
  retry_config?: {
    max_retries: number;
    retry_delay: number;
    exponential_backoff: boolean;
  } | null;
}

export interface MakeWebhookLog {
  id: string;
  webhook_id: string | null;
  event_type: string;
  payload: Record<string, any> | null;
  status: 'success' | 'failed' | 'pending';
  completed_at: string | null;
  created_at: string | null;
  duration_ms: number | null;
  error_message: string | null;
  request_headers: Record<string, any> | null;
  response_body: string | null;
  response_code: number | null;
  response_headers: Record<string, any> | null;
  severity: string | null;
  tags: string[] | null;
  context: Record<string, any> | null;
  retry_count?: number | null;
  next_retry_at?: string | null;
}

// New interface for field mapping with Telegram message data
export interface MakeFieldMapping {
  messageField: keyof import('./entities/Message').Message;
  targetField: string;
  description: string;
  dataType: 'string' | 'number' | 'boolean' | 'object' | 'array';
  isNested?: boolean;
  example?: any;
}

// New interface for Telegram-specific webhook templates
export interface MakeTelegramWebhookTemplate {
  id: string;
  name: string;
  description?: string | null;
  eventType: MakeEventType;
  fieldMapping: MakeFieldMapping[];
  template: Record<string, any>;
  isDefault?: boolean;
}

export interface MakeDebugSession {
  id: string;
  name: string;
  webhook_id: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string | null;
  notes: string | null;
  config: Record<string, any> | null;
}

export interface MakeDebugEvent {
  id: string;
  session_id: string | null;
  event_type: string;
  data: Record<string, any> | null;
  level: string | null;
  timestamp: string | null;
}

export interface MakeTestPayload {
  id: string;
  name: string;
  description: string | null;
  event_type: string;
  payload: Record<string, any>;
  is_template: boolean | null;
  created_at: string | null;
  updated_at: string | null;
} 
