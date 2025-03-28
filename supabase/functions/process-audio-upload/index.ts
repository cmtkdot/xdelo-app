import { serve } from "https://deno.land/std@0.168.0/http/server.ts"; // Keep for serve
import {
  createHandler,
  createSuccessResponse,
  RequestMetadata,
  SecurityLevel,
} from "../_shared/unifiedHandler.ts";
import { supabaseClient } from "../_shared/supabase.ts"; // Use singleton client
import { logProcessingEvent } from "../_shared/consolidatedMessageUtils.ts";

interface ProcessAudioBody {
  entryId: string;
}

// Core logic for processing audio upload
async function handleProcessAudio(req: Request, metadata: RequestMetadata): Promise<Response> {
  const { correlationId } = metadata;
  console.log(`[${correlationId}] Processing process-audio-upload request`);

  // --- Environment Variable Check ---
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    console.error(`[${correlationId}] OPENAI_API_KEY environment variable is not set`);
    await logProcessingEvent('audio_processing_failed', 'system', correlationId, {}, 'Missing OpenAI API Key');
    throw new Error('Configuration error: OpenAI API key is missing.');
  }

  // --- Request Body Parsing and Validation ---
  let requestBody: ProcessAudioBody;
  try {
    requestBody = await req.json();
  } catch (parseError: unknown) {
    const errorMessage = parseError instanceof Error ? parseError.message : "Invalid JSON body";
    console.error(`[${correlationId}] Failed to parse request body: ${errorMessage}`);
    throw new Error(`Invalid request: ${errorMessage}`);
  }

  const { entryId } = requestBody;
  if (!entryId) {
    console.error(`[${correlationId}] Missing required field entryId`);
    throw new Error("Invalid request: Entry ID (entryId) is required.");
  }

  await logProcessingEvent('audio_processing_started', entryId, correlationId);
  console.log(`[${correlationId}] Processing audio entry: ${entryId}`);

  try {
    // --- Fetch Entry Details ---
    const { data: entry, error: fetchError } = await supabaseClient
      .from('raw_product_entries')
      .select('*') // Select necessary fields: audio_url, storage_path
      .eq('id', entryId)
      .single();

    if (fetchError) {
      console.error(`[${correlationId}] Error fetching entry ${entryId}:`, fetchError);
      await logProcessingEvent('audio_processing_failed', entryId, correlationId, { stage: 'fetch_entry' }, fetchError.message);
      throw new Error(`Database error fetching entry: ${fetchError.message}`);
    }
    if (!entry) {
        console.error(`[${correlationId}] Entry ${entryId} not found.`);
        await logProcessingEvent('audio_processing_failed', entryId, correlationId, { stage: 'fetch_entry' }, 'Entry not found');
        throw new Error(`Entry not found: ${entryId}`);
    }
    if (!entry.storage_path) { // Check storage_path instead of audio_url
      console.error(`[${correlationId}] No storage path found for entry ${entryId}`);
      await logProcessingEvent('audio_processing_failed', entryId, correlationId, { stage: 'fetch_entry' }, 'Missing storage path');
      throw new Error(`Configuration error: No storage path found for entry ${entryId}`);
    }

    console.log(`[${correlationId}] Entry ${entryId} found. Storage path: ${entry.storage_path}`);

    // --- Download Audio from Storage ---
    let audioBlob: Blob;
    try {
      const { data: audioData, error: downloadError } = await supabaseClient
        .storage
        .from('product-audio') // Ensure this bucket name is correct
        .download(entry.storage_path);

      if (downloadError) {
        console.error(`[${correlationId}] Failed to download audio for entry ${entryId}:`, downloadError);
        await logProcessingEvent('audio_processing_failed', entryId, correlationId, { stage: 'download_audio', path: entry.storage_path }, downloadError.message);
        throw new Error(`Storage download error: ${downloadError.message}`);
      }
      if (!audioData) {
         console.error(`[${correlationId}] Audio download returned no data for entry ${entryId}`);
         await logProcessingEvent('audio_processing_failed', entryId, correlationId, { stage: 'download_audio', path: entry.storage_path }, 'No audio data downloaded');
         throw new Error(`Storage download error: No audio data received for ${entry.storage_path}`);
      }

      // Determine mime type from path or assume webm/ogg
      const mimeType = entry.storage_path.endsWith('.ogg') ? 'audio/ogg' : 'audio/webm';
      audioBlob = new Blob([audioData], { type: mimeType });
      console.log(`[${correlationId}] Audio downloaded successfully for entry ${entryId}. Size: ${audioBlob.size}, Type: ${mimeType}`);

    } catch (downloadException: unknown) {
        const errorMessage = downloadException instanceof Error ? downloadException.message : "Audio download exception";
        console.error(`[${correlationId}] Exception downloading audio for entry ${entryId}:`, errorMessage);
        await logProcessingEvent('audio_processing_failed', entryId, correlationId, { stage: 'download_audio_exception', path: entry.storage_path }, errorMessage);
        throw new Error(`Storage download error: ${errorMessage}`);
    }


    // --- Call OpenAI Whisper API ---
    let whisperResult: any;
    try {
      const formData = new FormData();
      // Use the correct filename based on mimeType
      const fileName = audioBlob.type === 'audio/ogg' ? 'audio.ogg' : 'audio.webm';
      formData.append('file', audioBlob, fileName);
      formData.append('model', 'whisper-1');
      formData.append('language', 'en'); // Make configurable?
      formData.append('response_format', 'verbose_json');

      console.log(`[${correlationId}] Sending audio to Whisper API for entry ${entryId}`);
      const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'X-Correlation-ID': correlationId, // Pass correlation ID
        },
        body: formData,
      });

      if (!whisperResponse.ok) {
        let errorBody: any = null;
        try { errorBody = await whisperResponse.json(); } catch (_) { /* ignore */ }
        const errorMsg = errorBody?.error?.message || whisperResponse.statusText || `HTTP ${whisperResponse.status}`;
        console.error(`[${correlationId}] Whisper API error (${whisperResponse.status}) for entry ${entryId}: ${errorMsg}`, errorBody);
        await logProcessingEvent('audio_processing_failed', entryId, correlationId, { stage: 'whisper_api', status: whisperResponse.status }, errorMsg);
        throw new Error(`Whisper API Error (${whisperResponse.status}): ${errorMsg}`);
      }

      whisperResult = await whisperResponse.json();
      console.log(`[${correlationId}] Whisper transcription successful for entry ${entryId}. Text length: ${whisperResult?.text?.length}`);
      await logProcessingEvent('audio_transcribed', entryId, correlationId, { textLength: whisperResult?.text?.length });

    } catch (whisperError: unknown) {
        const errorMessage = whisperError instanceof Error ? whisperError.message : "Whisper API request failed";
        // Avoid double logging if already logged above
        if (!errorMessage.startsWith('Whisper API Error')) {
            console.error(`[${correlationId}] Exception calling Whisper API for entry ${entryId}:`, errorMessage);
            await logProcessingEvent('audio_processing_failed', entryId, correlationId, { stage: 'whisper_api_exception' }, errorMessage);
        }
        throw new Error(`Whisper API error: ${errorMessage}`);
    }

    // --- Update Entry in Database ---
    try {
      const updateData = {
        processing_status: 'processed',
        processed_at: new Date().toISOString(),
        extracted_data: { // Consider merging with existing data if applicable
          transcription: whisperResult?.text,
          // Extract confidence more robustly if needed
          confidence: whisperResult?.segments?.[0]?.confidence,
          language: whisperResult?.language,
          duration: whisperResult?.duration,
          processed_at: new Date().toISOString() // Redundant? processed_at covers this
        },
        needs_manual_review: true // Flag for review
      };

      const { error: updateError } = await supabaseClient
        .from('raw_product_entries')
        .update(updateData)
        .eq('id', entryId);

      if (updateError) {
        console.error(`[${correlationId}] Error updating entry ${entryId} after processing:`, updateError);
        await logProcessingEvent('audio_processing_failed', entryId, correlationId, { stage: 'update_entry' }, updateError.message);
        throw new Error(`Database error updating entry: ${updateError.message}`);
      }

      console.log(`[${correlationId}] Entry ${entryId} updated successfully.`);
      await logProcessingEvent('audio_processing_completed', entryId, correlationId);

    } catch (updateDbError: unknown) {
        const errorMessage = updateDbError instanceof Error ? updateDbError.message : "DB update failed";
         if (!errorMessage.startsWith('Database error updating entry')) {
            console.error(`[${correlationId}] Exception updating entry ${entryId}:`, errorMessage);
            await logProcessingEvent('audio_processing_failed', entryId, correlationId, { stage: 'update_entry_exception' }, errorMessage);
         }
        throw new Error(`Database update error: ${errorMessage}`);
    }

    // --- Success Response ---
    return createSuccessResponse(
      {
        message: 'Audio processing completed successfully',
        entryId,
        transcription: whisperResult?.text,
      },
      correlationId
    );

  } catch (error: unknown) {
    // This catch block is primarily for errors thrown explicitly above
    // unifiedHandler will catch and log these appropriately
    const errorMessage = error instanceof Error ? error.message : "Unknown error processing audio";
    // Log one final time if not already logged in detail
    if (!errorMessage.includes('error:')) { // Avoid logging generic wrapper messages
        console.error(`[${correlationId}] Top-level error processing audio for entry ${entryId}: ${errorMessage}`);
        // Optionally log here if needed, but unifiedHandler should cover it
        // await logProcessingEvent('audio_processing_failed', entryId || 'unknown', correlationId, { stage: 'top_level' }, errorMessage);
    }
    throw error; // Re-throw for unifiedHandler
  }
}

// Create and configure the handler
const handler = createHandler(handleProcessAudio)
  .withMethods(['POST'])
  .withSecurity(SecurityLevel.AUTHENTICATED) // Assume processing requires auth
  .build();

// Serve the handler
serve(handler);

console.log("process-audio-upload function deployed and listening.");
