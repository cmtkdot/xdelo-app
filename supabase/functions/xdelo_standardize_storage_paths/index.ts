
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';
import { Database } from '../_shared/types.ts';
import { xdelo_validateAndFixStoragePath } from '../_shared/mediaUtils.ts';

// Get environment variables
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// Create Supabase client
const supabase = createClient<Database>(
  supabaseUrl,
  supabaseServiceKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

// Log function to standardize logging
function log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(JSON.stringify({
    timestamp,
    level,
    function: 'xdelo_standardize_storage_paths',
    message,
    ...(data && { data })
  }));
}

// Check if file exists in storage
async function verifyFileExists(storagePath: string, bucket: string = 'telegram-media'): Promise<boolean> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(storagePath, 60);
    
    return !error && !!data;
  } catch (error) {
    log('error', 'Error verifying file existence', { error: error.message, storagePath });
    return false;
  }
}

// Main handler for standardizing storage paths
Deno.serve(async (req) => {
  // Handle CORS for preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse request body
    const { limit = 100, dryRun = false, messageIds = [] } = await req.json();
    
    // Validate inputs
    if (limit < 1 || limit > 1000) {
      throw new Error('Limit must be between 1 and 1000');
    }

    // Store Supabase URL in app_settings if not exists
    await supabase.rpc('xdelo_ensure_app_settings_exists', {
      p_supabase_url: supabaseUrl
    });

    log('info', 'Starting storage path standardization', { limit, dryRun, messageIds });

    // Process messages using the updated function
    const results = await processStoragePaths(messageIds, limit, dryRun);

    // Log success
    log('info', 'Completed storage path standardization', { 
      fixed: results.fixed, 
      skipped: results.skipped,
      needs_redownload: results.needs_redownload
    });

    // Return response with CORS headers
    return new Response(
      JSON.stringify({
        success: true,
        message: `Standardized storage paths (${results.fixed} fixed, ${results.skipped} skipped)`,
        stats: results,
        error: null
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (err) {
    // Log and return error
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    log('error', 'Function execution failed', { error: errorMessage });
    
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Error processing request',
        error: errorMessage
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});

// Process storage paths for messages using improved path generation
async function processStoragePaths(
  messageIds: string[] = [],
  limit: number = 100,
  dryRun: boolean = false
): Promise<{ fixed: number; skipped: number; needs_redownload: number; details: any[] }> {
  // Build query to find messages to process
  let query = supabase
    .from('messages')
    .select('id, file_unique_id, mime_type, storage_path, public_url, mime_type_original')
    .eq('deleted_from_telegram', false)
    .is('file_unique_id', 'not', null);
    
  // If specific message IDs provided, use those
  if (messageIds && messageIds.length > 0) {
    query = query.in('id', messageIds);
  } else {
    // Otherwise prioritize messages with issues in their URLs
    query = query
      .or('public_url.is.null,public_url.eq.,public_url.like.%.jpeg')
      .order('created_at', { ascending: false })
      .limit(limit);
  }
  
  const { data: messages, error: queryError } = await query;
  
  if (queryError) {
    throw new Error(`Failed to fetch messages: ${queryError.message}`);
  }
  
  log('info', `Found ${messages?.length || 0} messages to process`, { 
    messageCount: messages?.length || 0,
    dryRun
  });
  
  const results = {
    processed: messages?.length || 0,
    fixed: 0,
    skipped: 0,
    needs_redownload: 0,
    details: [] as any[]
  };
  
  // Process each message
  for (const message of messages || []) {
    try {
      if (!message.file_unique_id || (!message.mime_type && !message.mime_type_original)) {
        results.details.push({
          message_id: message.id,
          success: false,
          reason: 'Missing file_unique_id or mime_type'
        });
        results.skipped++;
        continue;
      }
      
      // Use the shared utility for standardizing storage paths
      const standardizedPath = xdelo_validateAndFixStoragePath(
        message.file_unique_id,
        message.mime_type || message.mime_type_original || 'application/octet-stream'
      );
      
      // If storage path needs to be updated
      if (standardizedPath !== message.storage_path) {
        // Check if file exists at the old path
        const oldPathExists = message.storage_path ? 
          await verifyFileExists(message.storage_path) : 
          false;
        
        // Check if file already exists at the new path
        const newPathExists = await verifyFileExists(standardizedPath);
        
        let publicUrl = '';
        let needsUpdate = true;
        
        if (!newPathExists && oldPathExists) {
          // If only exists at old path and not a dry run, copy to the new path
          if (!dryRun) {
            try {
              log('info', `Copying file from ${message.storage_path} to ${standardizedPath}`, { messageId: message.id });
              
              await supabase.storage
                .from('telegram-media')
                .copy(message.storage_path, standardizedPath);
              
              publicUrl = `${supabaseUrl}/storage/v1/object/public/telegram-media/${standardizedPath}`;
            } catch (copyError) {
              log('error', `Error copying file`, { 
                from: message.storage_path, 
                to: standardizedPath,
                error: copyError.message 
              });
              
              results.details.push({
                message_id: message.id,
                success: false,
                error: `Copy failed: ${copyError.message}`,
                old_path: message.storage_path,
                new_path: standardizedPath
              });
              
              results.skipped++;
              continue;
            }
          } else {
            // In dry run mode, just report what would happen
            log('info', `Would copy file from ${message.storage_path} to ${standardizedPath}`, { 
              messageId: message.id,
              dryRun: true
            });
            
            publicUrl = `${supabaseUrl}/storage/v1/object/public/telegram-media/${standardizedPath}`;
          }
        } else if (!newPathExists && !oldPathExists) {
          // File doesn't exist in either location
          results.details.push({
            message_id: message.id,
            success: false,
            error: 'File not found in storage',
            old_path: message.storage_path,
            new_path: standardizedPath
          });
          
          // Mark for redownload if not a dry run
          if (!dryRun) {
            await supabase
              .from('messages')
              .update({
                needs_redownload: true,
                redownload_reason: 'Storage path repair - file not found',
                redownload_flagged_at: new Date().toISOString()
              })
              .eq('id', message.id);
          }
          
          results.needs_redownload++;
          continue;
        } else if (newPathExists) {
          // File already exists at new path
          publicUrl = `${supabaseUrl}/storage/v1/object/public/telegram-media/${standardizedPath}`;
          log('info', `File already exists at standardized path`, { 
            messageId: message.id,
            path: standardizedPath
          });
        }
        
        // Update the database with the new path if needed and not in dry run mode
        if (needsUpdate && !dryRun) {
          await supabase
            .from('messages')
            .update({
              storage_path: standardizedPath,
              public_url: publicUrl,
              storage_path_standardized: true,
              storage_exists: true,
              updated_at: new Date().toISOString()
            })
            .eq('id', message.id);
        }
        
        results.details.push({
          message_id: message.id,
          success: true,
          dryRun,
          old_path: message.storage_path,
          new_path: standardizedPath,
          new_url: publicUrl
        });
        
        results.fixed++;
      } else {
        // Path already correct, verify file exists
        const fileExists = await verifyFileExists(standardizedPath);
        
        if (!fileExists) {
          // File doesn't exist even though path is correct
          if (!dryRun) {
            await supabase
              .from('messages')
              .update({
                needs_redownload: true,
                redownload_reason: 'Storage path correct but file missing',
                redownload_flagged_at: new Date().toISOString()
              })
              .eq('id', message.id);
          }
          
          results.details.push({
            message_id: message.id,
            success: false,
            error: 'File not found in storage despite correct path',
            path: standardizedPath
          });
          
          results.needs_redownload++;
        } else {
          // Check if public URL is correct
          const expectedPublicUrl = `${supabaseUrl}/storage/v1/object/public/telegram-media/${standardizedPath}`;
          
          if (message.public_url !== expectedPublicUrl) {
            if (!dryRun) {
              await supabase
                .from('messages')
                .update({
                  public_url: expectedPublicUrl,
                  storage_exists: true,
                  updated_at: new Date().toISOString()
                })
                .eq('id', message.id);
            }
            
            results.details.push({
              message_id: message.id,
              success: true,
              dryRun,
              status: 'url_fixed',
              path: standardizedPath,
              old_url: message.public_url,
              new_url: expectedPublicUrl
            });
            
            results.fixed++;
          } else {
            results.details.push({
              message_id: message.id,
              success: true,
              status: 'already_correct',
              path: standardizedPath
            });
            
            results.skipped++;
          }
        }
      }
    } catch (messageError) {
      log('error', `Error processing message ${message.id}`, { error: messageError.message });
      
      results.details.push({
        message_id: message.id,
        success: false,
        error: messageError.message
      });
      
      results.skipped++;
    }
  }
  
  return results;
}
