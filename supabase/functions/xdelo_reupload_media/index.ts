
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { 
  xdelo_downloadMediaFromTelegram,
  xdelo_uploadMediaToStorage,
  xdelo_detectMimeType,
  xdelo_checkFileExistsInStorage
} from "../telegram-webhook/utils/media/mediaUtils.ts";
import { corsHeaders } from "../telegram-webhook/utils/cors.ts";
import { Logger } from "../telegram-webhook/utils/logger.ts";

// For Deno compatibility
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// Basic validation function for required fields
function validateRequest(req: any): string | null {
  if (!req) return "Missing request body";
  if (!req.messageId) return "Missing required field: messageId";
  return null;
}

serve(async (req: Request) => {
  // Generate a correlation ID for tracing
  const correlationId = crypto.randomUUID();
  const logger = new Logger(correlationId, 'xdelo_reupload_media');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    // Get environment variables
    const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!telegramBotToken || !supabaseUrl || !supabaseKey) {
      throw new Error('Missing required environment variables');
    }
    
    // Parse the request
    const requestData = await req.json();
    logger.info('Reupload request received', { 
      headers: Object.fromEntries(req.headers.entries()),
      message_id: requestData?.messageId
    });
    
    // Validate the request
    const validationError = validateRequest(requestData);
    if (validationError) {
      logger.error('Invalid request', { error: validationError });
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: validationError,
          correlationId 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Get the message ID
    const { messageId, forceReupload = false, skipExistingCheck = false } = requestData;
    
    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      global: {
        headers: {
          'X-Client-Info': 'xdelo_reupload_media'
        }
      }
    });
    
    // Fetch the message
    const { data: message, error: fetchError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();
    
    if (fetchError || !message) {
      logger.error('Message not found', { 
        error: fetchError?.message || 'Message does not exist',
        message_id: messageId
      });
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Message not found: ${fetchError?.message || 'Message does not exist'}`,
          correlationId 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Log message details
    logger.info('Retrieved message for reupload', {
      message_id: messageId,
      file_unique_id: message.file_unique_id,
      has_file_id: !!message.file_id,
      storage_path: message.storage_path
    });
    
    // Check if file exists in storage and we don't need to force reupload
    if (!forceReupload && !skipExistingCheck && message.storage_path) {
      logger.info('Checking if file exists in storage', { storage_path: message.storage_path });
      const fileExists = await xdelo_checkFileExistsInStorage(message.storage_path);
      
      if (fileExists) {
        logger.success('File already exists in storage', { 
          storage_path: message.storage_path,
          public_url: message.public_url
        });
        
        // Update the message to confirm storage exists
        await supabase
          .from('messages')
          .update({
            storage_exists: true,
            needs_redownload: false,
            redownload_completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', messageId);
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'File already exists in storage, no reupload needed',
            existing: true,
            storage_path: message.storage_path,
            correlationId 
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      logger.info('File does not exist in storage, proceeding with reupload', { 
        storage_path: message.storage_path 
      });
    }
    
    // If we need to use the original file_id
    if (!message.file_id || !message.file_unique_id) {
      logger.error('Invalid message data', { 
        has_file_id: !!message.file_id,
        has_file_unique_id: !!message.file_unique_id
      });
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Message has no file_id or file_unique_id',
          correlationId 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Get the MIME type
    const mimeType = message.mime_type || 
                     message.mime_type_original || 
                     (message.telegram_data ? xdelo_detectMimeType(message.telegram_data) : 'application/octet-stream');
    
    logger.info('Downloading media from Telegram', {
      file_id: message.file_id,
      file_unique_id: message.file_unique_id,
      mime_type: mimeType
    });
    
    // Download from Telegram
    const downloadResult = await xdelo_downloadMediaFromTelegram(
      message.file_id,
      message.file_unique_id,
      mimeType,
      telegramBotToken
    );
    
    // Handle file_id expiration
    if (!downloadResult.success && downloadResult.file_id_expired) {
      logger.warn('File ID has expired', { 
        message_id: messageId,
        file_id: message.file_id
      });
      
      // Update the message
      await supabase
        .from('messages')
        .update({
          needs_redownload: true,
          redownload_reason: 'file_id_expired_in_reupload',
          file_id_expires_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'File ID has expired and cannot be used for download',
          file_id_expired: true,
          correlationId 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    if (!downloadResult.success || !downloadResult.blob) {
      logger.error('Failed to download media', { 
        error: downloadResult.error,
        file_id: message.file_id
      });
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Failed to download media: ${downloadResult.error}`,
          correlationId 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Upload to Supabase Storage
    const storagePath = downloadResult.storagePath || message.storage_path || `${message.file_unique_id}.bin`;
    logger.info('Uploading media to Supabase Storage', { 
      storage_path: storagePath,
      mime_type: downloadResult.mimeType || mimeType
    });
    
    const uploadResult = await xdelo_uploadMediaToStorage(
      storagePath,
      downloadResult.blob,
      downloadResult.mimeType || mimeType,
      messageId
    );
    
    if (!uploadResult.success) {
      logger.error('Failed to upload media', { 
        error: uploadResult.error,
        storage_path: storagePath
      });
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Failed to upload media: ${uploadResult.error}`,
          correlationId 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    logger.success('Media upload successful', {
      storage_path: storagePath,
      public_url: uploadResult.publicUrl
    });
    
    // Update the message
    await supabase
      .from('messages')
      .update({
        storage_path: storagePath,
        public_url: uploadResult.publicUrl,
        storage_exists: true,
        storage_path_standardized: true,
        needs_redownload: false,
        redownload_completed_at: new Date().toISOString(),
        processing_state: message.processing_state === 'error' ? 'initialized' : message.processing_state,
        updated_at: new Date().toISOString(),
        error_message: null
      })
      .eq('id', messageId);
    
    // Return success
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Media successfully reuploaded',
        storage_path: storagePath,
        public_url: uploadResult.publicUrl,
        correlationId 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    logger.error('Error processing reupload request', {
      error: error.message,
      stack: error.stack
    });
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: `Server error: ${error.message}`,
        correlationId 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
