import { SupabaseClient } from "@supabase/supabase-js";

export type ProcessingState = 'initialized' | 'pending' | 'processing' | 'completed' | 'error';

export const PROCESSING_STATES: Record<string, ProcessingState> = {
  INITIALIZED: 'initialized',
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  ERROR: 'error'
};

export interface ProcessingMetadata {
  state: ProcessingState;
  completedAt?: string;
  correlationId: string;
  lastProcessedAt: string;
  syncAttempt: number;
  error?: string;
}

export interface MediaGroupInfo {
  messageCount: number;
  firstMessageTime: string | null;
  lastMessageTime: string | null;
  analyzedContent?: Record<string, any>;
}

export async function getMediaGroupInfo(
  supabase: SupabaseClient,
  mediaGroupId: string
): Promise<MediaGroupInfo | undefined> {
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('media_group_id', mediaGroupId)
    .order('created_at', { ascending: true });

  if (!messages?.length) {
    return undefined;
  }

  // Find any analyzed content in the group
  const analyzedMessage = messages.find(m => m.analyzed_content);

  return {
    messageCount: messages.length,
    firstMessageTime: messages[0]?.created_at || null,
    lastMessageTime: messages[messages.length - 1]?.created_at || null,
    analyzedContent: analyzedMessage?.analyzed_content
  };
}

export async function syncMediaGroupContent(
  supabase: SupabaseClient,
  sourceMessageId: string,
  mediaGroupId: string,
  correlationId?: string
): Promise<void> {
  await supabase.rpc('xdelo_sync_media_group_content', {
    p_source_message_id: sourceMessageId,
    p_media_group_id: mediaGroupId,
    p_correlation_id: correlationId
  });
}
