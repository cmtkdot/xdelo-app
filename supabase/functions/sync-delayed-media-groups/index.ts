import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessingMessage {
  id: string;
  media_group_id: string | null;
  analyzed_content: any;
  processing_state: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get request body
    const requestData = await req.json().catch(() => ({}));
    const specificGroupId = requestData.media_group_id;

    console.log('Starting media group sync', { specificGroupId });

    // Base query for messages that need processing
    let query = supabaseClient
      .from('messages')
      .select('*')
      .in('processing_state', ['initialized', 'pending', 'error', 'processing'])
      .not('media_group_id', 'is', null);

    // If specific group ID provided, only process that group
    if (specificGroupId) {
      query = query.eq('media_group_id', specificGroupId);
    }

    // Get messages to process
    const { data: messagesToProcess, error: fetchError } = await query
      .order('created_at', { ascending: true });

    if (fetchError) {
      throw fetchError;
    }

    console.log(`Found ${messagesToProcess?.length || 0} messages to process`);

    // Group messages by media_group_id
    const messageGroups = messagesToProcess?.reduce((groups: Record<string, ProcessingMessage[]>, message) => {
      if (message.media_group_id) {
        if (!groups[message.media_group_id]) {
          groups[message.media_group_id] = [];
        }
        groups[message.media_group_id].push(message);
      }
      return groups;
    }, {});

    // Process each group
    for (const [mediaGroupId, messages] of Object.entries(messageGroups || {})) {
      console.log(`Processing media group ${mediaGroupId} with ${messages.length} messages`);

      // Get total count for this group (including completed messages)
      const { count: totalCount } = await supabaseClient
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('media_group_id', mediaGroupId);

      // Find a message in the group that has analyzed content
      const { data: analyzedMessages } = await supabaseClient
        .from('messages')
        .select('*')
        .eq('media_group_id', mediaGroupId)
        .not('analyzed_content', 'is', null)
        .order('created_at', { ascending: true })
        .limit(1);

      if (!analyzedMessages?.length) {
        console.log(`No analyzed content found for group ${mediaGroupId}, skipping`);
        continue;
      }

      const analyzedContent = analyzedMessages[0].analyzed_content;

      console.log(`Updating ${messages.length} messages with analyzed content`);

      // Update all messages in the group
      const { error: updateError } = await supabaseClient
        .from('messages')
        .update({
          analyzed_content: analyzedContent,
          processing_state: 'completed',
          processing_completed_at: new Date().toISOString(),
          group_message_count: totalCount
        })
        .eq('media_group_id', mediaGroupId);

      if (updateError) {
        console.error(`Error updating group ${mediaGroupId}:`, updateError);
        continue;
      }

      console.log(`Successfully updated group ${mediaGroupId}`);
    }

    return new Response(
      JSON.stringify({ 
        message: 'Sync completed',
        groups_processed: Object.keys(messageGroups || {}).length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
