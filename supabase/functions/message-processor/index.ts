import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
    corsHeaders,
    formatErrorResponse,
    formatSuccessResponse,
    logEvent,
    parseCaption,
    supabase,
    syncMediaGroup,
    updateMessageState
} from "../_shared/baseUtils.ts";
import type { AnalyzedContent } from "../_shared/types.ts";

interface ProcessorRequest {
  action: 'parse_caption' | 'analyze_with_ai' | 'process_media_group';
  messageId: string;
  correlationId?: string;
  syncMediaGroup?: boolean;
  options?: {
    aiModel?: string;
    temperature?: number;
  };
}

/**
 * Handles message processing requests (manual parsing, AI analysis, media group sync)
 */
async function processMessage(request: ProcessorRequest): Promise<Record<string, unknown>> {
  // Generate correlation ID if not provided
  const correlationId = request.correlationId || crypto.randomUUID();
  
  // Validate request
  if (!request.messageId) {
    return {
      success: false,
      error: 'Message ID is required',
      correlationId
    };
  }
  
  const messageId = request.messageId;
  
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Fetch message from database
    const { data: message, error: fetchError } = await supabaseClient
      .from('messages')
      .select('id, caption, text, telegram_message_id, chat_id, media_group_id, processing_state')
      .eq('id', messageId)
      .single();
    
    if (fetchError || !message) {
      await logEvent(
        'message_processing_error',
        messageId,
        correlationId,
        { error: fetchError?.message || 'Message not found', action: request.action },
        fetchError?.message || 'Message not found'
      );
      
      return {
        success: false,
        error: fetchError?.message || 'Message not found',
        correlationId
      };
    }
    
    // Update message state to processing
    await supabaseClient.rpc('xdelo_update_message_state', {
      p_message_id: messageId,
      p_new_state: 'processing',
      p_correlation_id: correlationId
    })
    
    // Process based on action type
    let analyzedContent: AnalyzedContent | null = null;
    
    switch (request.action) {
      case 'parse_caption':
        // Manual caption parsing
        const caption = message.caption || message.text || '';
        analyzedContent = await parseCaption(caption, {
          trigger_source: 'manual',
          processing_time: Date.now()
        });
        break;
        
      case 'analyze_with_ai':
        // AI-based analysis
        analyzedContent = await analyzeWithAI(
          message.caption || message.text || '',
          request.options || {},
          messageId,
          correlationId
        );
        break;
        
      case 'process_media_group':
        // Skip content analysis and just sync the media group
        if (!message.media_group_id) {
          return {
            success: false,
            error: 'Message is not part of a media group',
            correlationId
          };
        }
        
        const syncResult = await syncMediaGroup(
          messageId,
          message.media_group_id,
          correlationId,
          request.syncMediaGroup || false,
          false // Don't sync edit history by default
        );
        
        return {
          success: syncResult.success,
          messageId,
          mediaGroupId: message.media_group_id,
          syncResult,
          correlationId
        };
        
      default:
        return {
          success: false,
          error: `Unsupported action: ${request.action}`,
          correlationId
        };
    }
    
    // Add processing metadata
    if (analyzedContent && analyzedContent.parsing_metadata) {
      analyzedContent.parsing_metadata.action = request.action;
      analyzedContent.parsing_metadata.processor_version = '1.0.0';
    }
    
    // Update database with analyzed content
    const updateResult = await supabaseClient.rpc('xdelo_update_message_state', {
      p_message_id: messageId,
      p_new_state: 'completed',
      p_correlation_id: correlationId,
      p_analyzed_content: analyzedContent
    })
    
    if (!updateResult.success) {
      return {
        success: false,
        error: updateResult.error || 'Failed to update message state',
        correlationId
      };
    }
    
    // Log the successful analysis
    await logEvent(
      'message_processing_completed',
      messageId,
      correlationId,
      {
        telegram_message_id: message.telegram_message_id,
        chat_id: message.chat_id,
        media_group_id: message.media_group_id,
        action: request.action,
        content_length: (message.caption || message.text || '').length
      }
    );
    
    // If message is part of a media group and sync is requested, sync the content
    if (message.media_group_id && request.syncMediaGroup !== false) {
      const syncResult = await syncMediaGroup(
        messageId,
        message.media_group_id,
        correlationId,
        request.syncMediaGroup || false
      );
      
      // Return result with sync info
      return {
        success: true,
        messageId,
        content: message.caption || message.text || '',
        analyzedContent,
        correlationId,
        mediaGroupSynced: syncResult.success,
        mediaGroupId: message.media_group_id,
        syncResult
      };
    }
    
    // Return result without sync
    return {
      success: true,
      messageId,
      content: message.caption || message.text || '',
      analyzedContent,
      correlationId
    };
  } catch (error) {
    // Log error
    await logEvent(
      'message_processing_error',
      messageId,
      correlationId,
      { error: error.message, action: request.action },
      error.message
    );
    
    // Update message state to error
    await supabaseClient.rpc('xdelo_update_message_state', {
      p_message_id: messageId,
      p_new_state: 'error',
      p_correlation_id: correlationId,
      p_error_message: error.message
    })
    
    return {
      success: false,
      error: `Message processing failed: ${error.message}`,
      correlationId
    };
  }
}

/**
 * Analyze text using AI
 */
async function analyzeWithAI(
  text: string,
  options: Record<string, any>,
  messageId: string,
  correlationId: string
): Promise<AnalyzedContent> {
  // This is a placeholder - in a real implementation, this would call OpenAI or another AI service
  // For now, we'll return a basic analysis
  
  if (!text || text.trim() === '') {
    return {
      raw_text: text,
      parsing_metadata: {
        success: true,
        empty_content: true,
        trigger_source: 'ai',
        model: options.aiModel || 'default',
        parsing_time: Date.now().toString()
      },
      parsed_at: new Date().toISOString()
    };
  }
  
  // Log AI request
  await logEvent(
    'ai_analysis_started',
    messageId,
    correlationId,
    {
      model: options.aiModel || 'default',
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 1000,
      content_length: text.length
    }
  );
  
  // Mock AI analysis result
  return {
    raw_text: text,
    content_type: 'text',
    parsing_metadata: {
      success: true,
      trigger_source: 'ai',
      model: options.aiModel || 'default',
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 1000,
      parsing_time: Date.now().toString()
    },
    entities: {
      // Simple entity extraction simulation
      keywords: text.split(/\s+/).filter(word => word.length > 5).slice(0, 5),
      categories: [],
      sentiment: Math.random() > 0.5 ? 'positive' : 'negative'
    },
    summary: text.length > 100 ? text.substring(0, 100) + '...' : text,
    parsed_at: new Date().toISOString()
  };
}

// Handle requests
serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { action, messageId, correlationId = crypto.randomUUID(), options = {} } = 
      await req.json() as ProcessorRequest

    // Validate request
    if (!messageId || !action) {
      throw new Error('Missing required parameters: messageId and action')
    }

    // Process message
    const result = await processMessage({ action, messageId, correlationId, options });
    
    // Return appropriate response
    if (result.success) {
      return formatSuccessResponse(result, result.correlationId as string);
    } else {
      return formatErrorResponse(result.error as string, result.correlationId as string, 400);
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return formatErrorResponse(
      `Failed to process request: ${error.message}`,
      undefined,
      500
    );
  }
}); 