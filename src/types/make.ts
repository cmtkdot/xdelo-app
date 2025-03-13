export enum MakeEventType {
  MessageReceived = 'message_received',
  ChannelJoined = 'channel_joined',
  ChannelLeft = 'channel_left',
  UserJoined = 'user_joined',
  UserLeft = 'user_left',
  MediaReceived = 'media_received',
  CommandReceived = 'command_received'
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