import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
serve(async (req) => {
  // Handle preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    const request = await req.json() as MediaProcessorRequest;
    const correlationId = crypto.randomUUID();
    
    // Validate request
    if (!request.action) {
      return formatErrorResponse('Action is required', correlationId);
    }
    
    // Action router
    switch (request.action) {
      case 'fix_content_disposition':
        return await fixContentDisposition(request.messageIds, correlationId);
      case 'repair_metadata':
        return await repairFileMetadata(request.messageId || request.messageIds, correlationId);
      case 'validate_files':
        return await validateMediaFiles(request.messageIds, correlationId);
      case 'fix_mime_types':
        return await fixMissingMimeTypes(correlationId);
      case 'standardize_storage_paths':
        return await standardizeStoragePaths(request.messageIds, correlationId, request.options);
      default:
        return formatErrorResponse(`Unknown action: ${request.action}`, correlationId);
    }
  } catch (error) {
    console.error('Error in media-processor function:', error);
    return formatErrorResponse(
      error.message || 'Unknown error',
      undefined,
      400
    );
  }
});

/**
 * Fix content disposition for files
 */
async function fixContentDisposition(messageIds?: string[], correlationId?: string): Promise<Response> {
  try {
    let query = supabase.from('messages').select('id, storage_path, mime_type, file_unique_id');
    
    // If specific message IDs were provided, use those
    if (messageIds && messageIds.length > 0) {
      query = query.in('id', messageIds);
    } else {
      // Otherwise, get the latest 100 files
      query = query.order('created_at', { ascending: false }).limit(100);
    }
    
    // Only process files with storage paths
    query = query.not('storage_path', 'is', null);
    
    const { data: messages, error } = await query;
    
    if (error) throw error;
    
    const results = [];
    const successful = [];
    const failed = [];
    
    // Process each message's file
    for (const message of messages) {
      try {
        if (message.storage_path) {
          // Log operation start
          await logEvent(
            'fix_content_disposition_started',
            message.id,
            correlationId,
            { storage_path: message.storage_path }
          );
          
          const success = await xdelo_repairContentDisposition(`telegram-media/${message.storage_path}`);
          
          if (success) {
            successful.push(message.id);
            results.push({
              message_id: message.id,
              file_unique_id: message.file_unique_id,
              success: true
            });
            
            // Log success
            await logEvent(
              'fix_content_disposition_completed',
              message.id,
              correlationId,
              { storage_path: message.storage_path, success: true }
            );
          } else {
            failed.push(message.id);
            results.push({
              message_id: message.id,
              file_unique_id: message.file_unique_id,
              success: false,
              error: 'Failed to repair content disposition'
            });
            
            // Log failure
            await logEvent(
              'fix_content_disposition_error',
              message.id,
              correlationId,
              { storage_path: message.storage_path, success: false },
              'Failed to repair content disposition'
            );
          }
        } else {
          failed.push(message.id);
          results.push({
            message_id: message.id,
            file_unique_id: message.file_unique_id,
            success: false,
            error: 'No storage path available'
          });
        }
      } catch (error) {
        console.error(`Error processing message ${message.id}:`, error);
        failed.push(message.id);
        results.push({
          message_id: message.id,
          file_unique_id: message.file_unique_id,
          success: false,
          error: error.message
        });
        
        // Log error
        await logEvent(
          'fix_content_disposition_error',
          message.id,
          correlationId,
          { storage_path: message.storage_path, error: error.message },
          error.message
        );
      }
    }
    
    return formatSuccessResponse({
      processed: messages.length,
      successful: successful.length,
      failed: failed.length,
      results
    }, correlationId);
  } catch (error) {
    console.error('Error in fixContentDisposition:', error);
    return formatErrorResponse(error.message, correlationId, 500);
  }
}

/**
 * Repair file metadata for specific messages
 */
async function repairFileMetadata(messageIdOrIds: string | string[], correlationId?: string): Promise<Response> {
  try {
    const messageIds = Array.isArray(messageIdOrIds) 
      ? messageIdOrIds 
      : [messageIdOrIds];
    
    const results = [];
    
    for (const messageId of messageIds) {
      // Log operation start
      await logEvent(
        'repair_metadata_started',
        messageId,
        correlationId,
        { messageId }
      );
      
      try {
        const result = await xdelo_recoverFileMetadata(messageId);
        results.push({
          message_id: messageId,
          ...result
        });
        
        // Log result
        if (result.success) {
          await logEvent(
            'repair_metadata_completed',
            messageId,
            correlationId,
            { ...result }
          );
        } else {
          await logEvent(
            'repair_metadata_error',
            messageId,
            correlationId,
            { ...result },
            result.error
          );
        }
      } catch (error) {
        results.push({
          message_id: messageId,
          success: false,
          error: error.message
        });
        
        // Log error
        await logEvent(
          'repair_metadata_error',
          messageId,
          correlationId,
          { error: error.message },
          error.message
        );
      }
    }
    
    return formatSuccessResponse({
      results
    }, correlationId);
  } catch (error) {
    console.error('Error in repairFileMetadata:', error);
    return formatErrorResponse(error.message, correlationId, 500);
  }
}

/**
 * Validate media files exist in storage
 */
async function validateMediaFiles(messageIds?: string[], correlationId?: string): Promise<Response> {
  try {
    let query = supabase.from('messages').select('id, storage_path, public_url, mime_type, file_unique_id');
    
    // If specific message IDs were provided, use those
    if (messageIds && messageIds.length > 0) {
      query = query.in('id', messageIds);
    } else {
      // Otherwise get a reasonable batch
      query = query.order('created_at', { ascending: false }).limit(50);
    }
    
    const { data: messages, error } = await query;
    
    if (error) throw error;
    
    const results = [];
    const issues = [];
    
    for (const message of messages) {
      // Skip messages without storage path
      if (!message.storage_path) {
        results.push({
          message_id: message.id,
          file_unique_id: message.file_unique_id,
          status: 'missing_storage_path'
        });
        issues.push(message.id);
        continue;
      }
      
      try {
        // Log operation start
        await logEvent(
          'validate_media_started',
          message.id,
          correlationId,
          { storage_path: message.storage_path }
        );
        
        // Check if the file exists in storage
        const exists = await supabase.storage
          .from('telegram-media')
          .createSignedUrl(message.storage_path, 60)
          .then(({ data, error }) => {
            return !error && !!data;
          })
          .catch(() => false);
        
        if (exists) {
          results.push({
            message_id: message.id,
            file_unique_id: message.file_unique_id,
            status: 'exists'
          });
          
          // Log success
          await logEvent(
            'validate_media_completed',
            message.id,
            correlationId,
            { storage_path: message.storage_path, exists: true }
          );
        } else {
          results.push({
            message_id: message.id,
            file_unique_id: message.file_unique_id,
            status: 'not_found',
            storage_path: message.storage_path
          });
          issues.push(message.id);
          
          // Log failure
          await logEvent(
            'validate_media_error',
            message.id,
            correlationId,
            { storage_path: message.storage_path, exists: false },
            'Media file not found in storage'
          );
        }
      } catch (error) {
        results.push({
          message_id: message.id,
          file_unique_id: message.file_unique_id,
          status: 'error',
          error: error.message
        });
        issues.push(message.id);
        
        // Log error
        await logEvent(
          'validate_media_error',
          message.id,
          correlationId,
          { storage_path: message.storage_path, error: error.message },
          error.message
        );
      }
    }
    
    return formatSuccessResponse({
      processed: messages.length,
      issues: issues.length,
      results
    }, correlationId);
  } catch (error) {
    console.error('Error in validateMediaFiles:', error);
    return formatErrorResponse(error.message, correlationId, 500);
  }
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