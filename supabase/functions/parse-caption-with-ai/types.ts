export interface ParsedContent {
  product_name: string;  // Required
  product_code?: string;
  vendor_uid?: string;
  purchase_date?: string;
  quantity?: number;
  notes?: string;
  parsing_metadata?: {
    method: 'manual' | 'ai' | 'hybrid';
    confidence: number;
    fallbacks_used?: string[];
    timestamp: string;
    needs_ai_analysis?: boolean;
    manual_confidence?: number;
    ai_confidence?: number;
  };
}

export interface QuantityParseResult {
  value: number;
  confidence: number;
}

export type ProcessingState = 'pending' | 'processing' | 'completed' | 'error';

export interface MessageBase {
  id: string;
  created_at: string;
  processing_state: ProcessingState;
  caption?: string;
  analyzed_content?: ParsedContent;
}

export interface ProcessingMetadata {
  correlation_id: string;
  method?: 'manual' | 'ai' | 'hybrid';
  timestamp?: string;
  error?: string;
  sync_time?: string;
  source_message_id?: string;
  is_source?: boolean;
  sync_completed_at?: string;
  sync_failed_at?: string;
  last_processed_at?: string;
  last_error_at?: string;
}

export interface GroupMetadata {
  first_message_time: string;
  last_message_time: string;
  message_count: number;
}

export interface StateLogEntry {
  message_id: string;
  previous_state: ProcessingState;
  new_state: ProcessingState;
  changed_at: string;
  metadata: {
    correlation_id: string;
    sync_type: string;
    source_message_id: string;
  };
}

export interface DatabaseMessage extends MessageBase {
  processing_completed_at?: string;
  processing_started_at?: string;
  is_original_caption?: boolean;
  group_caption_synced?: boolean;
  message_caption_id?: string;
  group_first_message_time?: string;
  group_last_message_time?: string;
  group_message_count?: number;
  group_completed_at?: string;
  updated_at: string;
  processing_metadata?: ProcessingMetadata;
  error_message?: string;
  last_error_at?: string;
}

// Simplified Supabase types for our use case
export interface SupabaseResponse<T> {
  data: T[] | null;
  error: Error | null;
}

export interface QueryFilter<T> {
  eq: (column: string, value: string | null) => Promise<{ data: T[] | null; error: Error | null }>;
  neq: (column: string, value: string) => Promise<{ data: T[] | null; error: Error | null }>;
  maybeSingle: () => Promise<{ data: T | null; error: Error | null }>;
}

export interface QueryBuilder<T> {
  select: (columns: string, options?: { count?: string }) => {
    eq: (column: string, value: string | null) => Promise<{ data: T[] | null; error: Error | null }>;
    neq: (column: string, value: string) => Promise<{ data: T[] | null; error: Error | null }>;
    maybeSingle: () => Promise<{ data: T | null; error: Error | null }>;
  };
  update: (data: Partial<T>) => {
    eq: (column: string, value: string | null) => Promise<{ data: T | null; error: Error | null }>;
    neq: (column: string, value: string) => Promise<{ data: T | null; error: Error | null }>;
  };
  insert: <U = T>(data: Partial<U>[]) => Promise<{ data: U[] | null; error: Error | null }>;
}

export interface SupabaseClient {
  from: <T = DatabaseMessage>(table: string) => QueryBuilder<T>;
  rpc: (
    functionName: string,
    params?: Record<string, unknown>
  ) => Promise<{ data: unknown; error: Error | null }>;
  functions: {
    invoke: (
      functionName: string,
      options: {
        body: Record<string, unknown>;
      }
    ) => Promise<{
      data: unknown;
      error: Error | null;
    }>;
  };
}

export interface SupabaseEdgeFunction {
  name: string;
  options: {
    body: Record<string, unknown>;
  };
}

export async function syncMediaGroup(
  supabase: SupabaseClient,
  messageId: string,
  mediaGroupId: string | null,
  analyzedContent: ParsedContent
) {
  if (!mediaGroupId) return;

  try {
    console.log('🔄 Starting media group sync:', { messageId, mediaGroupId });

    // First get all messages in the group
    const { data: groupMessages, error: fetchError } = await supabase
      .from('messages')
      .select('id')
      .eq('media_group_id', mediaGroupId);

    if (fetchError) throw fetchError;
    if (!groupMessages) throw new Error('No messages found');

    // Update all other messages in the group
    const updateQuery = supabase
      .from('messages')
      .update({
        analyzed_content: analyzedContent,
        processing_state: 'completed' as ProcessingState,
        processing_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    // Update each message in the group
    for (const msg of groupMessages) {
      if (msg.id !== messageId) {
        const { error: msgError } = await updateQuery.eq('id', msg.id);
        if (msgError) {
          console.error(`Failed to update message ${msg.id}:`, msgError);
        }
      }
    }

    console.log('✅ Media group sync completed:', {
      messageId,
      mediaGroupId,
      messagesUpdated: groupMessages.length - 1
    });

  } catch (error) {
    console.error('❌ Error in media group sync:', error);
    throw error;
  }
}

// For Deno environment in edge functions
declare global {
  const Deno: {
    env: {
      get(key: string): string | undefined;
    };
  };
}