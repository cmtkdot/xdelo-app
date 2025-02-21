import { SupabaseClient } from "@supabase/supabase-js";

export const PROCESSING_STATES = {
  INITIALIZED: 'initialized',
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed'
} as const;

export type ProcessingState = typeof PROCESSING_STATES[keyof typeof PROCESSING_STATES];

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
  uploadedCount: number;
  firstMessageTime: string | null;
  lastMessageTime: string | null;
  analyzedMessageId: string | null;
  analyzedContent: any | null;
  hasCaption: boolean;
  isComplete: boolean;
}

export async function getMediaGroupInfo(
  supabase: SupabaseClient,
  mediaGroupId: string
): Promise<MediaGroupInfo> {
  // Get all messages in the group
  const { data: messages, error } = await supabase
    .from('messages')
    .select('*')
    .eq('media_group_id', mediaGroupId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  // Get analyzed message if exists
  const analyzedMessage = messages?.find(msg => msg.analyzed_content && msg.is_original_caption);

  return {
    messageCount: messages?.length || 0,
    uploadedCount: messages?.filter(msg => msg.public_url).length || 0,
    firstMessageTime: messages?.[0]?.created_at || null,
    lastMessageTime: messages?.[messages.length - 1]?.created_at || null,
    analyzedMessageId: analyzedMessage?.id || null,
    analyzedContent: analyzedMessage?.analyzed_content || null,
    hasCaption: messages?.some(msg => msg.caption) || false,
    isComplete: Boolean(messages?.length && messages.every(msg => msg.public_url))
  };
}

export async function syncMediaGroupContent(
  supabase: SupabaseClient,
  sourceMessageId: string,
  mediaGroupId: string,
  correlationId: string = crypto.randomUUID()
): Promise<void> {
  try {
    // Get source message content
    const { data: sourceMessage, error: sourceError } = await supabase
      .from('messages')
      .select('analyzed_content')
      .eq('id', sourceMessageId)
      .single();

    if (sourceError) throw sourceError;
    if (!sourceMessage?.analyzed_content) {
      throw new Error('Source message has no analyzed content');
    }

    // Update all messages in the group
    const { error: updateError } = await supabase
      .rpc('sync_media_group_content', {
        p_source_message_id: sourceMessageId,
        p_media_group_id: mediaGroupId,
        p_correlation_id: correlationId
      });

    if (updateError) throw updateError;

    console.log('✅ Successfully synced media group content:', {
      source_id: sourceMessageId,
      media_group_id: mediaGroupId,
      correlation_id: correlationId
    });
  } catch (error) {
    console.error('❌ Failed to sync media group content:', {
      source_id: sourceMessageId,
      media_group_id: mediaGroupId,
      correlation_id: correlationId,
      error
    });
    throw error;
  }
}
