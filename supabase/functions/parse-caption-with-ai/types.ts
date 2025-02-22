export interface ParsedResult {
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  purchase_date?: string;
  quantity?: number;
  notes?: string;
  parsing_metadata?: {
    method: 'manual' | 'ai' | 'hybrid';
    confidence: number;
    timestamp: string;
    fallbacks_used?: string[];
    needs_ai_analysis?: boolean;
  };
  analysis?: {
    strain_type?: string;
    thc_percentage?: number | null;
    cbd_percentage?: number | null;
    flavor_profile?: string[];
    effects?: string[];
  };
}

export interface QuantityParseResult {
  value: number;
  confidence: number;
}

export type ProcessingState = 'initialized' | 'pending' | 'processing' | 'completed' | 'error' | 'no_caption';

export interface AnalyzedContent {
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  purchase_date?: string;
  quantity?: number;
  notes?: string;
  parsing_metadata?: {
    method: 'manual' | 'ai' | 'hybrid';
    confidence: number;
    timestamp: string;
    manual_success?: boolean;
    fallbacks_used?: string[];
  };
  analysis?: {
    strain_type?: string;
    thc_percentage?: number | null;
    cbd_percentage?: number | null;
    flavor_profile?: string[];
    effects?: string[];
  };
  sync_metadata?: {
    sync_source_message_id?: string;
    media_group_id?: string;
    synced_at?: string;
  };
}

export interface AIAnalysisResult {
  content: AnalyzedContent;
  confidence: number;
}

export interface MessageUpdate {
  analyzed_content: AnalyzedContent;
  processing_state: ProcessingState;
  processing_completed_at?: string;
  is_original_caption?: boolean;
  group_caption_synced?: boolean;
  message_caption_id?: string;
  error_message?: string;
  last_error_at?: string;
}

export interface AnalysisRequest {
  messageId: number;
  caption: string;
  media_group_id?: string;
  correlation_id?: string;
  chat_id?: number;
}

export interface WebhookLogEntry {
  event_type: 
    | 'analysis_start' 
    | 'analysis_complete' 
    | 'analysis_error'
    | 'manual_parse_success'
    | 'manual_parse_fallback'
    | 'ai_analysis_start'
    | 'ai_analysis_complete';
  chat_id: number;
  message_id: number;
  correlation_id: string;
  media_type?: string;
  processing_state?: string;
  duration_ms?: number;
  error_message?: string;
  metadata?: Record<string, any>;
  raw_data?: Record<string, any>;
}

// Add logging helper
export async function logParserEvent(
  supabase: SupabaseClient,
  event: WebhookLogEntry
): Promise<void> {
  try {
    await supabase.from('webhook_logs').insert({
      ...event,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to log parser event:', {
      error,
      correlation_id: event.correlation_id,
      event_type: event.event_type
    });
  }
}
