
export interface AnalysisRequest {
  messageId: string;
  caption?: string;
  isEdit?: boolean;
  correlationId?: string;
  trigger_source?: string;
}

export interface MediaGroupResult {
  success: boolean;
  media_group_id: string;
  synced_count: number;
  error?: string;
}

export interface AnalysisResponse {
  success: boolean;
  message_id: string;
  analyzed: boolean;
  caption_length: number;
  has_media_group: boolean;
  media_group_id?: string;
  media_group_synced?: boolean;
  synced_count?: number;
  validation_result?: {
    valid: boolean;
    missing_fields?: string[];
    invalid_formats?: string[];
  };
  error?: string;
}

export interface FlowStage {
  id: string;
  name: string;
  description: string;
  required_fields?: string[];
  validations?: {
    fields: string[];
    type: 'required' | 'format' | 'custom';
    pattern?: string;
    custom_validator?: string;
  }[];
  next_stage?: string;
  previous_stage?: string;
  actions?: {
    type: 'function' | 'trigger' | 'edge_function';
    name: string;
    parameters?: Record<string, any>;
  }[];
}

// Content flow stages
export const FLOW_STAGES = {
  INITIALIZED: 'initialized',
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  ERROR: 'error',
  PARTIAL_SUCCESS: 'partial_success'
};
