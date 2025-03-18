
import { 
  xdelo_createStandardizedHandler, 
  xdelo_createSuccessResponse, 
  xdelo_createErrorResponse 
} from "../_shared/standardizedHandler.ts";
import { createSupabaseClient } from "../_shared/supabase.ts";

// Main handler function
const handleAudioUpload = async (req: Request, correlationId: string): Promise<Response> => {
  // Parse request body
  const { entryId } = await req.json();

  if (!entryId) {
    return xdelo_createErrorResponse('Entry ID is required', correlationId, 400);
  }
  
  console.log(JSON.stringify({
    level: 'info',
    message: 'Processing audio entry',
    entry_id: entryId,
    correlation_id: correlationId,
    timestamp: new Date().toISOString()
  }));

  // Create Supabase client
  const supabase = createSupabaseClient();

  try {
    // Get the entry details
    const { data: entry, error: fetchError } = await supabase
      .from('raw_product_entries')
      .select('*')
      .eq('id', entryId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch entry: ${fetchError.message}`);
    }

    if (!entry.audio_url) {
      throw new Error('No audio URL found for entry');
    }

    console.log(`Audio URL: ${entry.audio_url}`);

    // First, try to get the audio file from storage
    const { data: audioData, error: audioError } = await supabase
      .storage
      .from('product-audio')
      .download(entry.storage_path);

    if (audioError) {
      throw new Error(`Failed to download audio file: ${audioError.message}`);
    }

    // Convert the audio data to a blob
    const audioBlob = new Blob([audioData], { type: 'audio/webm' });

    // Prepare form data for Whisper API
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');
    formData.append('response_format', 'verbose_json');

    // Get the OpenAI API key
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }

    // Send to OpenAI Whisper API
    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.error('Whisper API error:', errorText);
      throw new Error(`Whisper API error: ${errorText}`);
    }

    const whisperResult = await whisperResponse.json();
    console.log('Whisper transcription completed');

    // Update the entry with transcription
    const { error: updateError } = await supabase
      .from('raw_product_entries')
      .update({
        processing_status: 'processed',
        processed_at: new Date().toISOString(),
        extracted_data: {
          transcription: whisperResult.text,
          confidence: whisperResult.segments[0]?.confidence || 0,
          processed_at: new Date().toISOString()
        },
        needs_manual_review: true
      })
      .eq('id', entryId);

    if (updateError) {
      throw new Error(`Failed to update entry: ${updateError.message}`);
    }

    // Log successful processing
    await supabase
      .from('unified_audit_logs')
      .insert({
        event_type: 'audio_processing_completed',
        entity_id: entryId,
        metadata: {
          correlation_id: correlationId,
          transcript_length: whisperResult.text.length,
          confidence: whisperResult.segments[0]?.confidence || 0,
          timestamp: new Date().toISOString()
        },
        correlation_id: correlationId
      });

    return xdelo_createSuccessResponse({
      entryId,
      transcription: whisperResult.text,
      confidence: whisperResult.segments[0]?.confidence || 0
    }, correlationId, 'Audio processing completed');
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      message: 'Error processing audio',
      error: error.message,
      entry_id: entryId,
      correlation_id: correlationId,
      timestamp: new Date().toISOString()
    }));

    // Log error to audit logs
    try {
      await supabase
        .from('unified_audit_logs')
        .insert({
          event_type: 'audio_processing_error',
          entity_id: entryId,
          error_message: error.message,
          metadata: {
            correlation_id: correlationId,
            timestamp: new Date().toISOString()
          },
          correlation_id: correlationId
        });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return xdelo_createErrorResponse(error.message, correlationId, 500);
  }
};

// Export the handler using our standardized wrapper
export default xdelo_createStandardizedHandler(handleAudioUpload);
