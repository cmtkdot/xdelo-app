
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Log an event to the unified audit system
 */
async function logEvent(
  supabase: any,
  eventType: string,
  entityId: string,
  metadata: Record<string, unknown> = {},
  correlationId?: string,
  errorMessage?: string
) {
  try {
    // Generate a correlation ID if not provided
    const logCorrelationId = correlationId || `storage_cleanup_${crypto.randomUUID()}`;
    
    // Insert the log entry
    const { error } = await supabase
      .from('unified_audit_logs')
      .insert({
        event_type: eventType,
        entity_id: entityId,
        metadata,
        correlation_id: logCorrelationId,
        error_message: errorMessage
      });
    
    if (error) {
      console.error('Error logging event:', error);
    }
    
    return logCorrelationId;
  } catch (err) {
    console.error('Failed to log event:', err);
    return null;
  }
}

/**
 * Delete a file from storage
 */
async function deleteFromStorage(supabase: any, storagePath: string, correlationId: string) {
  try {
    // Extract bucket and path from storage path
    // Format is typically: storage/bucket/path/to/file
    const parts = storagePath.split('/');
    if (parts.length < 3) {
      throw new Error(`Invalid storage path format: ${storagePath}`);
    }
    
    const bucket = parts[1];
    const path = parts.slice(2).join('/');
    
    // Delete the file from storage
    const { error } = await supabase
      .storage
      .from(bucket)
      .remove([path]);
      
    if (error) {
      throw error;
    }
    
    return true;
  } catch (error) {
    console.error(`Error deleting file from storage: ${storagePath}`, error);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Generate a correlation ID for this operation
  const correlationId = `storage_cleanup_${crypto.randomUUID()}`;
  
  try {
    const { message_id, cascade = true } = await req.json();

    if (!message_id) {
      throw new Error('Message ID is required');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Log the start of the cleanup process
    await logEvent(
      supabaseClient,
      'storage_deleted',
      message_id,
      { 
        operation: 'cleanup_started',
        cascade
      },
      correlationId
    );

    // Get message details before deletion
    const { data: message, error: fetchError } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('id', message_id)
      .single();

    if (fetchError) {
      await logEvent(
        supabaseClient,
        'storage_deleted',
        message_id,
        { 
          error: fetchError.message,
          operation: 'cleanup_failed',
          stage: 'fetch_message'
        },
        correlationId,
        fetchError.message
      );
      throw fetchError;
    }

    if (!message) {
      const errorMsg = 'Message not found';
      await logEvent(
        supabaseClient,
        'storage_deleted',
        message_id,
        { 
          error: errorMsg,
          operation: 'cleanup_failed',
          stage: 'message_not_found'
        },
        correlationId,
        errorMsg
      );
      return new Response(
        JSON.stringify({ 
          error: errorMsg,
          correlation_id: correlationId
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }
    
    // Check if this is part of a media group and we need to cascade delete
    const mediaGroupResults = [];
    if (cascade && message.media_group_id) {
      // Log the start of cascading deletion
      await logEvent(
        supabaseClient,
        'storage_deleted',
        message_id,
        { 
          media_group_id: message.media_group_id,
          operation: 'cascade_deletion_started'
        },
        correlationId
      );
      
      // Find all related messages in the same media group
      const { data: groupMessages, error: groupError } = await supabaseClient
        .from('messages')
        .select('id, storage_path, file_id, file_unique_id')
        .eq('media_group_id', message.media_group_id)
        .neq('id', message_id); // Exclude the current message
        
      if (groupError) {
        await logEvent(
          supabaseClient,
          'storage_deleted',
          message_id,
          { 
            media_group_id: message.media_group_id,
            error: groupError.message,
            operation: 'cascade_deletion_failed',
            stage: 'fetch_group_messages'
          },
          correlationId,
          groupError.message
        );
      } else if (groupMessages && groupMessages.length > 0) {
        // Process each related message
        for (const groupMsg of groupMessages) {
          try {
            // Delete the file from storage if it has a storage path
            let storageResult = null;
            if (groupMsg.storage_path) {
              storageResult = await deleteFromStorage(
                supabaseClient, 
                groupMsg.storage_path,
                correlationId
              );
            }
            
            // Delete the message from the database
            const { error: deleteError } = await supabaseClient
              .from('messages')
              .delete()
              .eq('id', groupMsg.id);
              
            mediaGroupResults.push({
              id: groupMsg.id,
              storage_deleted: storageResult,
              database_deleted: !deleteError,
              error: deleteError ? deleteError.message : null
            });
            
            // Log the result for this group message
            await logEvent(
              supabaseClient,
              'storage_deleted',
              groupMsg.id,
              { 
                media_group_id: message.media_group_id,
                parent_message_id: message_id,
                storage_path: groupMsg.storage_path,
                storage_deleted: storageResult,
                database_deleted: !deleteError,
                operation: deleteError ? 'group_message_deletion_failed' : 'group_message_deleted'
              },
              correlationId,
              deleteError ? deleteError.message : null
            );
          } catch (groupMsgError) {
            console.error(`Error processing group message ${groupMsg.id}:`, groupMsgError);
            mediaGroupResults.push({
              id: groupMsg.id,
              error: groupMsgError.message
            });
            
            // Log the error
            await logEvent(
              supabaseClient,
              'storage_deleted',
              groupMsg.id,
              { 
                media_group_id: message.media_group_id,
                parent_message_id: message_id,
                error: groupMsgError.message,
                operation: 'group_message_deletion_failed'
              },
              correlationId,
              groupMsgError.message
            );
          }
        }
      }
      
      // Log the completion of cascading deletion
      await logEvent(
        supabaseClient,
        'storage_deleted',
        message_id,
        { 
          media_group_id: message.media_group_id,
          group_results: mediaGroupResults,
          operation: 'cascade_deletion_completed'
        },
        correlationId
      );
    }
    
    // Delete the file from storage if it has a storage path
    let storageResult = null;
    if (message.storage_path) {
      storageResult = await deleteFromStorage(
        supabaseClient, 
        message.storage_path,
        correlationId
      );
      
      // Log the storage deletion result
      await logEvent(
        supabaseClient,
        'storage_deleted',
        message_id,
        { 
          storage_path: message.storage_path,
          storage_deleted: storageResult,
          operation: storageResult ? 'storage_deleted' : 'storage_deletion_failed'
        },
        correlationId,
        storageResult ? null : 'Failed to delete from storage'
      );
    }

    // Delete the message from the database
    const { error: deleteError } = await supabaseClient
      .from('messages')
      .delete()
      .eq('id', message_id);

    if (deleteError) {
      await logEvent(
        supabaseClient,
        'storage_deleted',
        message_id,
        { 
          error: deleteError.message,
          operation: 'database_deletion_failed'
        },
        correlationId,
        deleteError.message
      );
      throw deleteError;
    }
    
    // Log successful database deletion
    await logEvent(
      supabaseClient,
      'storage_deleted',
      message_id,
      { 
        operation: 'database_deletion_completed',
        storage_deleted: storageResult
      },
      correlationId
    );

    return new Response(
      JSON.stringify({ 
        success: true,
        storage_deleted: storageResult,
        media_group_results: mediaGroupResults.length > 0 ? mediaGroupResults : null,
        correlation_id: correlationId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        correlation_id: correlationId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
