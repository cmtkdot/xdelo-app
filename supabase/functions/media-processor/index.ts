import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
    corsHeaders,
    formatErrorResponse,
    formatSuccessResponse,
    logEvent,
    supabase
} from "../_shared/baseUtils.ts";
import {
    xdelo_detectMimeType,
    xdelo_recoverFileMetadata,
    xdelo_repairContentDisposition,
    xdelo_validateAndFixStoragePath
} from "../_shared/mediaUtils.ts";

interface MediaProcessorRequest {
  action: 'fix_content_disposition' | 'validate_files' | 'repair_metadata' | 'fix_mime_types' | 'standardize_storage_paths';
  messageId?: string;
  messageIds?: string[];
  options?: {
    batchSize?: number;
    deleteOrphaned?: boolean;
    fixMissingMimeTypes?: boolean;
    skipExisting?: boolean;
    dryRun?: boolean;
  };
}

/**
 * Unified media processor function
 */
serve(async (req: Request) => {
  // Handle preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { action, messageId, messageIds = [], options = {} } = 
      await req.json() as MediaProcessorRequest;

    // Validate request
    if (!action || (!messageId && messageIds.length === 0)) {
      throw new Error('Missing required parameters');
    }

    // Convert single messageId to array
    const targetMessageIds = messageId ? [messageId] : messageIds;

    let result;
    const correlationId = crypto.randomUUID();

    switch (action) {
      case 'fix_content_disposition':
        result = await handleContentDisposition(supabaseClient, targetMessageIds, correlationId);
        break;
      case 'validate_files':
        result = await handleFileValidation(supabaseClient, targetMessageIds, correlationId, options);
        break;
      case 'repair_metadata':
        result = await handleMetadataRepair(supabaseClient, targetMessageIds, correlationId);
        break;
      case 'fix_mime_types':
        result = await fixMissingMimeTypes(correlationId);
        break;
      case 'standardize_storage_paths':
        result = await standardizeStoragePaths(targetMessageIds, correlationId, options);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in media-processor function:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

/**
 * Fix content disposition for files
 */
async function handleContentDisposition(supabase: any, messageIds: string[], correlationId: string) {
  const results = [];
  
  for (const messageId of messageIds) {
    try {
      // Get message details
      const { data: message } = await supabase
        .from('messages')
        .select('*')
        .eq('id', messageId)
        .single();

      if (!message?.storage_path) continue;

      // Update Content-Disposition
      await supabase
        .storage
        .from('media')
        .update(
          message.storage_path,
          message.storage_path,
          {
            contentType: message.mime_type,
            cacheControl: '3600',
            upsert: true
          }
        );

      results.push({ messageId, success: true });
    } catch (error) {
      results.push({ messageId, success: false, error: error.message });
    }
  }

  return results;
}

/**
 * Validate media files exist in storage
 */
async function handleFileValidation(
  supabase: any, 
  messageIds: string[], 
  correlationId: string,
  options: { deleteOrphaned?: boolean } = {}
) {
  const results = [];

  for (const messageId of messageIds) {
    try {
      // Get message details
      const { data: message } = await supabase
        .from('messages')
        .select('*')
        .eq('id', messageId)
        .single();

      if (!message?.storage_path) {
        results.push({ messageId, exists: false, reason: 'no_storage_path' });
        continue;
      }

      // Check if file exists
      const { data } = await supabase
        .storage
        .from('media')
        .list('', {
          prefix: message.storage_path
        });

      const exists = data && data.length > 0;

      if (!exists && options.deleteOrphaned) {
        // Mark message as needing redownload
        await supabase
          .from('messages')
          .update({
            storage_exists: false,
            needs_redownload: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', messageId);
      }

      results.push({ messageId, exists, reason: exists ? null : 'file_not_found' });
    } catch (error) {
      results.push({ messageId, exists: false, error: error.message });
    }
  }

  return results;
}

/**
 * Repair file metadata for specific messages
 */
async function handleMetadataRepair(supabase: any, messageIds: string[], correlationId: string) {
  const results = [];

  for (const messageId of messageIds) {
    try {
      // Get message details
      const { data: message } = await supabase
        .from('messages')
        .select('*')
        .eq('id', messageId)
        .single();

      if (!message) {
        results.push({ messageId, success: false, reason: 'message_not_found' });
        continue;
      }

      // Extract metadata from telegram_data
      const telegramData = message.telegram_data;
      const updates: Record<string, any> = {
        updated_at: new Date().toISOString()
      };

      if (telegramData.photo) {
        const photo = telegramData.photo[telegramData.photo.length - 1];
        updates.width = photo.width;
        updates.height = photo.height;
        updates.file_size = photo.file_size;
      } else if (telegramData.video) {
        updates.width = telegramData.video.width;
        updates.height = telegramData.video.height;
        updates.duration = telegramData.video.duration;
        updates.file_size = telegramData.video.file_size;
      }

      // Update message
      await supabase
        .from('messages')
        .update(updates)
        .eq('id', messageId);

      results.push({ messageId, success: true, updates });
    } catch (error) {
      results.push({ messageId, success: false, error: error.message });
    }
  }

  return results;
}

/**
 * Fix missing MIME types for messages
 */
async function fixMissingMimeTypes(correlationId?: string): Promise<Response> {
  try {
    // Query messages with missing or invalid MIME types
    const { data: messages, error } = await supabase
      .from('messages')
      .select('id, storage_path, file_unique_id, mime_type')
      .or('mime_type.is.null,mime_type.eq.,mime_type.eq.application/octet-stream')
      .not('storage_path', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) throw error;
    
    const results = [];
    const fixed = [];
    const failed = [];
    
    for (const message of messages) {
      try {
        // Log operation start
        await logEvent(
          'fix_mime_type_started',
          message.id,
          correlationId,
          { storage_path: message.storage_path, original_mime_type: message.mime_type }
        );
        
        if (!message.storage_path) {
          results.push({
            message_id: message.id,
            success: false,
            error: 'No storage path available'
          });
          failed.push(message.id);
          continue;
        }
        
        // Detect MIME type from file extension or content
        const mimeType = await xdelo_detectMimeType(`telegram-media/${message.storage_path}`);
        
        if (mimeType) {
          // Update the message with the detected MIME type
          const { error: updateError } = await supabase
            .from('messages')
            .update({
              mime_type: mimeType,
              mime_type_verified: true,
              updated_at: new Date().toISOString()
            })
            .eq('id', message.id);
          
          if (updateError) {
            results.push({
              message_id: message.id,
              success: false,
              error: updateError.message
            });
            failed.push(message.id);
            
            // Log failure
            await logEvent(
              'fix_mime_type_error',
              message.id,
              correlationId,
              { 
                storage_path: message.storage_path, 
                detected_mime_type: mimeType,
                error: updateError.message
              },
              updateError.message
            );
          } else {
            results.push({
              message_id: message.id,
              success: true,
              original_mime_type: message.mime_type,
              new_mime_type: mimeType
            });
            fixed.push(message.id);
            
            // Log success
            await logEvent(
              'fix_mime_type_completed',
              message.id,
              correlationId,
              { 
                storage_path: message.storage_path, 
                original_mime_type: message.mime_type,
                new_mime_type: mimeType
              }
            );
          }
        } else {
          results.push({
            message_id: message.id,
            success: false,
            error: 'Could not detect MIME type'
          });
          failed.push(message.id);
          
          // Log failure
          await logEvent(
            'fix_mime_type_error',
            message.id,
            correlationId,
            { storage_path: message.storage_path },
            'Could not detect MIME type'
          );
        }
      } catch (error) {
        results.push({
          message_id: message.id,
          success: false,
          error: error.message
        });
        failed.push(message.id);
        
        // Log error
        await logEvent(
          'fix_mime_type_error',
          message.id,
          correlationId,
          { storage_path: message.storage_path, error: error.message },
          error.message
        );
      }
    }
    
    return formatSuccessResponse({
      processed: messages.length,
      fixed: fixed.length,
      failed: failed.length,
      results
    }, correlationId);
  } catch (error) {
    console.error('Error in fixMissingMimeTypes:', error);
    return formatErrorResponse(error.message, correlationId, 500);
  }
}

/**
 * Standardize storage paths for media files
 */
async function standardizeStoragePaths(
  messageIds?: string[],
  correlationId?: string,
  options?: Record<string, any>
): Promise<Response> {
  try {
    const dryRun = options?.dryRun || false;
    const skipExisting = options?.skipExisting !== false;
    const batchSize = options?.batchSize || 50;
    
    let query = supabase
      .from('messages')
      .select('id, file_id, file_unique_id, storage_path, storage_path_standardized')
      .not('file_id', 'is', null);
    
    // Filter by specific message IDs if provided
    if (messageIds && messageIds.length > 0) {
      query = query.in('id', messageIds);
    } else {
      // Otherwise process messages that need standardization
      if (skipExisting) {
        query = query.or('storage_path_standardized.is.null,storage_path_standardized.eq.false');
      }
      query = query.order('created_at', { ascending: false }).limit(batchSize);
    }
    
    const { data: messages, error } = await query;
    
    if (error) throw error;
    
    const results = [];
    const standardized = [];
    const skipped = [];
    const failed = [];
    
    for (const message of messages) {
      try {
        // Log operation start
        await logEvent(
          'standardize_path_started',
          message.id,
          correlationId,
          { 
            file_unique_id: message.file_unique_id,
            current_storage_path: message.storage_path,
            currently_standardized: message.storage_path_standardized
          }
        );
        
        // Skip if already standardized
        if (skipExisting && message.storage_path_standardized === true) {
          results.push({
            message_id: message.id,
            skipped: true,
            reason: 'Already standardized'
          });
          skipped.push(message.id);
          continue;
        }
        
        // Validate and fix the storage path
        const fixResult = await xdelo_validateAndFixStoragePath(
          message.id,
          message.file_unique_id,
          message.storage_path,
          dryRun
        );
        
        if (fixResult.success) {
          results.push({
            message_id: message.id,
            success: true,
            original_path: message.storage_path,
            new_path: fixResult.newPath,
            dry_run: dryRun
          });
          
          if (!dryRun) {
            standardized.push(message.id);
          }
          
          // Log success
          await logEvent(
            'standardize_path_completed',
            message.id,
            correlationId,
            { 
              file_unique_id: message.file_unique_id,
              original_path: message.storage_path,
              new_path: fixResult.newPath,
              dry_run: dryRun
            }
          );
        } else {
          results.push({
            message_id: message.id,
            success: false,
            error: fixResult.error
          });
          failed.push(message.id);
          
          // Log failure
          await logEvent(
            'standardize_path_error',
            message.id,
            correlationId,
            { 
              file_unique_id: message.file_unique_id,
              storage_path: message.storage_path,
              error: fixResult.error
            },
            fixResult.error
          );
        }
      } catch (error) {
        results.push({
          message_id: message.id,
          success: false,
          error: error.message
        });
        failed.push(message.id);
        
        // Log error
        await logEvent(
          'standardize_path_error',
          message.id,
          correlationId,
          { 
            file_unique_id: message.file_unique_id,
            storage_path: message.storage_path,
            error: error.message
          },
          error.message
        );
      }
    }
    
    return formatSuccessResponse({
      processed: messages.length,
      standardized: standardized.length,
      skipped: skipped.length,
      failed: failed.length,
      dry_run: dryRun,
      results
    }, correlationId);
  } catch (error) {
    console.error('Error in standardizeStoragePaths:', error);
    return formatErrorResponse(error.message, correlationId, 500);
  }
} 