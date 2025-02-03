export interface MediaItem {
  id: string;
  telegram_message_id: number;
  media_group_id?: string;
  message_caption_id?: string;
  is_original_caption?: boolean;
  group_caption_synced?: boolean;
  caption?: string;
  file_id?: string;
  file_unique_id: string;
  public_url?: string;
  mime_type?: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
  created_at?: string;
  updated_at?: string;
  user_id: string;
  processing_state?: ProcessingState;
  processing_started_at?: string;
  processing_completed_at?: string;
  analyzed_content?: AnalyzedContent | null;
  telegram_data?: Record<string, unknown>;
  error_message?: string;
  retry_count?: number;
  last_error_at?: string;
  group_first_message_time?: string;
  group_last_message_time?: string;
  group_message_count?: number;
}

export interface AnalyzedContent {
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  purchase_date?: string;
  quantity?: number;
  notes?: string;
  parsing_metadata?: ParsingMetadata;
}

export interface ParsingMetadata {
  method: 'manual' | 'ai' | 'hybrid';
  confidence: number;
  fallbacks_used?: string[];
  reanalysis_attempted?: boolean;
  previous_analysis?: AnalyzedContent;
}

export type ProcessingState = "initialized" | "pending" | "processing" | "completed" | "error";

export interface FilterValues {
  search: string;
  vendor: string;
  dateFrom?: Date;
  dateTo?: Date;
  dateField: 'purchase_date' | 'created_at' | 'updated_at';
  sortOrder: "desc" | "asc";
  productCode?: string;
  quantityRange?: string;
  processingState?: ProcessingState | "all";
}

export interface MessageUpdate {
  id: string;
  telegram_message_id?: number;
  media_group_id?: string;
  message_caption_id?: string;
  is_original_caption?: boolean;
  group_caption_synced?: boolean;
  caption?: string;
  analyzed_content?: AnalyzedContent | null;
  processing_state?: ProcessingState;
  processing_started_at?: string;
  processing_completed_at?: string;
}

export interface MediaGroupSync {
  source_message_id: string;
  media_group_id: string;
  analyzed_content: AnalyzedContent;
  is_original_caption: boolean;
  group_caption_synced: boolean;
  processing_state: ProcessingState;
}

export interface ExistingMessage {
  id: string;
  telegram_message_id: number;
  media_group_id?: string;
  file_unique_id: string;
  caption?: string;
  analyzed_content?: AnalyzedContent;
  processing_state: ProcessingState;
  is_original_caption: boolean;
  group_caption_synced: boolean;
  message_caption_id?: string;
}

export interface MessageSyncResult {
  success: boolean;
  message_id: string;
  media_group_id?: string;
  error?: string;
  sync_details?: {
    is_original_caption: boolean;
    group_caption_synced: boolean;
    processing_state: ProcessingState;
    sync_timestamp: string;
  };
}

// Base type for JSON data
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

// Processing metadata for analysis tracking

export interface ProcessingMetadata {
  correlation_id: string;
  timestamp: string;
  method: 'manual' | 'ai' | 'hybrid';
  confidence: number;
  original_caption: string;
  message_id: string;
  fallbacks_used?: string[];
  reanalysis_attempted?: boolean;
  previous_analysis?: AnalyzedContent;
  group_message_count?: number;
  is_original_caption?: boolean;
  error?: string;
  retry_count?: number;
}

// Type guard for JsonValue
export function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) return true;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value === 'object') {
    return Object.values(value as object).every(isJsonValue);
  }
  return false;
}

// Convert ProcessingMetadata to JsonValue
export function processingMetadataToJson(metadata: ProcessingMetadata): JsonValue {
  return {
    correlation_id: metadata.correlation_id,
    timestamp: metadata.timestamp,
    method: metadata.method,
    confidence: metadata.confidence,
    original_caption: metadata.original_caption,
    message_id: metadata.message_id,
    fallbacks_used: metadata.fallbacks_used || [],
    reanalysis_attempted: metadata.reanalysis_attempted || false,
    previous_analysis: metadata.previous_analysis ? analyzedContentToJson(metadata.previous_analysis) : null,
    group_message_count: metadata.group_message_count || null,
    is_original_caption: metadata.is_original_caption || false,
    error: metadata.error || null,
    retry_count: metadata.retry_count || 0
  };
}

// Convert ParsingMetadata to JsonValue
export function parsingMetadataToJson(metadata: ParsingMetadata): JsonValue {
  return {
    method: metadata.method,
    confidence: metadata.confidence,
    fallbacks_used: metadata.fallbacks_used || [],
    reanalysis_attempted: metadata.reanalysis_attempted || false,
    previous_analysis: metadata.previous_analysis ? analyzedContentToJson(metadata.previous_analysis) : null
  };
}

// Convert AnalyzedContent to JsonValue
export function analyzedContentToJson(analyzed: AnalyzedContent): JsonValue {
  if (!analyzed) return null;
  
  const result: { [key: string]: JsonValue } = {};
  
  if (analyzed.product_name) result.product_name = analyzed.product_name;
  if (analyzed.product_code) result.product_code = analyzed.product_code;
  if (analyzed.vendor_uid) result.vendor_uid = analyzed.vendor_uid;
  if (analyzed.purchase_date) result.purchase_date = analyzed.purchase_date;
  if (analyzed.quantity) result.quantity = analyzed.quantity;
  if (analyzed.notes) result.notes = analyzed.notes;
  
  if (analyzed.parsing_metadata) {
    result.parsing_metadata = {
      method: analyzed.parsing_metadata.method,
      confidence: analyzed.parsing_metadata.confidence,
      fallbacks_used: analyzed.parsing_metadata.fallbacks_used || [],
      reanalysis_attempted: analyzed.parsing_metadata.reanalysis_attempted || false,
      previous_analysis: analyzed.parsing_metadata.previous_analysis ? 
        analyzedContentToJson(analyzed.parsing_metadata.previous_analysis) : null
    };
  }
  
  return result;
}
