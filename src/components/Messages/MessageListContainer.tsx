
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MessageList } from './MessageList';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Message, AnalyzedContent } from '@/types';

export const MessageListContainer: React.FC = () => {
  const { data: messages, isLoading, error } = useQuery({
    queryKey: ['messages'],
    queryFn: async () => {
      const { data: rawMessages, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform raw messages to ensure type safety
      const transformedMessages: Message[] = (rawMessages || []).map(msg => ({
        ...msg,
        // Ensure analyzed_content is properly typed or null
        analyzed_content: msg.analyzed_content ? msg.analyzed_content as AnalyzedContent : undefined,
        // Ensure other required fields have default values
        id: msg.id,
        file_unique_id: msg.file_unique_id || '',
        telegram_data: msg.telegram_data || {},
        processing_state: msg.processing_state || 'initialized',
        chat_type: msg.chat_type || 'private',
        // Handle optional fields
        telegram_message_id: msg.telegram_message_id,
        media_group_id: msg.media_group_id,
        message_caption_id: msg.message_caption_id,
        is_original_caption: msg.is_original_caption || false,
        group_caption_synced: msg.group_caption_synced || false,
        caption: msg.caption,
        file_id: msg.file_id,
        file_size: msg.file_size,
        width: msg.width,
        height: msg.height,
        duration: msg.duration,
        user_id: msg.user_id,
        error_message: msg.error_message,
        retry_count: msg.retry_count || 0,
        created_at: msg.created_at,
        updated_at: msg.updated_at,
        chat_id: msg.chat_id,
        chat_title: msg.chat_title,
        message_url: msg.message_url,
        public_url: msg.public_url,
        mime_type: msg.mime_type,
        purchase_order: msg.purchase_order,
        glide_row_id: msg.glide_row_id
      }));

      return transformedMessages;
    }
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Error loading messages: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  if (!messages || messages.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          No messages found.
        </AlertDescription>
      </Alert>
    );
  }

  return <MessageList messages={messages} />;
};
