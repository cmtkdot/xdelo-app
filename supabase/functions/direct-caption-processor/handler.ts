
import { corsHeaders } from '../_shared/cors.ts';
import { supabaseClient } from '../_shared/supabase.ts';
import { AnalyzedContent, Message, ProcessingState } from '../_shared/types.ts';

export interface CaptionProcessorPayload {
  messageId: string;
  caption?: string;
  correlationId?: string;
  trigger_source?: string;
  force_reprocess?: boolean;
}

export async function handleDirectCaptionProcessor(req: Request): Promise<Response> {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    const payload: CaptionProcessorPayload = await req.json();
    const { messageId, caption, correlationId, force_reprocess } = payload;
    
    if (!messageId) {
      return new Response(
        JSON.stringify({ error: 'Message ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    // First get the message details
    const { data: message, error: messageError } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();
    
    if (messageError) {
      console.error('Error fetching message:', messageError);
      return new Response(
        JSON.stringify({ error: `Failed to fetch message: ${messageError.message}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }
    
    // If already processed and force_reprocess is not true, return early
    if (message.analyzed_content && message.processing_state === 'completed' && !force_reprocess) {
      return new Response(
        JSON.stringify({ success: true, message: 'Message already processed', status: 'already_processed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Use the caption from payload or from the message
    const textToProcess = caption || message.caption;
    
    if (!textToProcess) {
      // Update message to indicate no caption to process
      const { error: updateError } = await supabaseClient
        .from('messages')
        .update({
          processing_state: 'no_caption' as ProcessingState,
          error_message: 'No caption available to process',
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId);
      
      if (updateError) {
        console.error('Error updating message status:', updateError);
      }
      
      return new Response(
        JSON.stringify({ error: 'No caption to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    // Update message to processing state
    await supabaseClient
      .from('messages')
      .update({
        processing_state: 'processing' as ProcessingState,
        processing_started_at: new Date().toISOString(),
        processing_correlation_id: correlationId ? correlationId : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);
    
    // Call the SQL function to parse caption
    const { data: parsedData, error: parsedError } = await supabaseClient.rpc(
      'xdelo_parse_caption',
      { p_caption: textToProcess }
    );
    
    if (parsedError) {
      console.error('Error parsing caption:', parsedError);
      
      // Update message with error state
      await supabaseClient
        .from('messages')
        .update({
          processing_state: 'error' as ProcessingState,
          error_message: `Failed to parse caption: ${parsedError.message}`,
          last_error_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          processing_attempts: supabaseClient.sql`COALESCE(processing_attempts, 0) + 1`
        })
        .eq('id', messageId);
      
      return new Response(
        JSON.stringify({ error: `Failed to parse caption: ${parsedError.message}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
    
    const analyzedContent = parsedData as AnalyzedContent;
    
    // Update the message with the analyzed content
    const { error: updateError } = await supabaseClient.rpc(
      'xdelo_update_message_with_analyzed_content',
      {
        p_message_id: messageId,
        p_analyzed_content: analyzedContent,
        p_is_edit: false
      }
    );
    
    if (updateError) {
      console.error('Error updating message with analyzed content:', updateError);
      
      // Update message with error state
      await supabaseClient
        .from('messages')
        .update({
          processing_state: 'error' as ProcessingState,
          error_message: `Failed to update message: ${updateError.message}`,
          last_error_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          processing_attempts: supabaseClient.sql`COALESCE(processing_attempts, 0) + 1`
        })
        .eq('id', messageId);
      
      return new Response(
        JSON.stringify({ error: `Failed to update message: ${updateError.message}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        messageId,
        analyzedContent,
        status: 'processed'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unhandled error in caption processor:', error);
    return new Response(
      JSON.stringify({ error: `Unhandled error: ${error.message}` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}
