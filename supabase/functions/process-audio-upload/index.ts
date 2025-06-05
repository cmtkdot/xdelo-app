
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createHandler, SecurityLevel, RequestMetadata 
} from "../_shared/unifiedHandler.ts";
import { supabaseClient } from "../_shared/supabase.ts"; // Use singleton client
import { logProcessingEvent } from "../_shared/auditLogger.ts"; // Import from dedicated module

interface ProcessAudioBody {
  audio_url: string;
  metadata?: Record<string, any>;
}

// Define the core handler logic for processing audio uploads
const processAudioHandler = async (req: Request, metadata: RequestMetadata) => {
  try {
    const { audio_url, metadata: audioMetadata = {} } = await req.json() as ProcessAudioBody;
    
    // Validate input
    if (!audio_url) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Missing required audio_url parameter", 
          correlationId: metadata.correlationId 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' }}
      );
    }
    
    // Log the processing request
    await logProcessingEvent(
      'audio_processing_requested',
      'system', // Will be replaced with actual ID after processing
      metadata.correlationId,
      {
        audio_url,
        source: 'process-audio-upload',
        ...audioMetadata
      }
    );
    
    // Here you would implement the actual audio processing logic
    // This is a placeholder for where that implementation would go
    const processingResult = {
      id: crypto.randomUUID(),
      status: 'processed',
      url: audio_url,
      timestamp: new Date().toISOString()
    };
    
    // Log successful processing
    await logProcessingEvent(
      'audio_processing_completed',
      processingResult.id,
      metadata.correlationId,
      {
        audio_url,
        result: processingResult,
        source: 'process-audio-upload'
      }
    );
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        data: processingResult,
        correlationId: metadata.correlationId
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' }}
    );
    
  } catch (error) {
    // Log the error
    await logProcessingEvent(
      'audio_processing_failed',
      'system',
      metadata.correlationId,
      {
        error: error instanceof Error ? error.message : String(error),
        source: 'process-audio-upload'
      },
      error instanceof Error ? error.message : String(error)
    );
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error),
        correlationId: metadata.correlationId
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' }}
    );
  }
};

// Create the handler instance using the unified handler builder
const handler = createHandler(processAudioHandler)
  .withMethods(['POST'])
  .withSecurity(SecurityLevel.PUBLIC)
  .withLogging(true)
  .withMetrics(true);

// Serve the built handler
serve(handler.build());
