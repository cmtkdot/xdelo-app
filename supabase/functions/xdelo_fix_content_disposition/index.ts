
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';
import { 
  xdelo_isViewableMimeType, 
  xdelo_validateMimeType, 
  xdelo_getUploadOptions 
} from '../_shared/mediaUtils.ts';

// Create Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Function to fix content disposition for a single file
async function fixContentDisposition(
  messageId: string
): Promise<{success: boolean, message: string, data?: any}> {
  try {
    // Get the message
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('id, file_unique_id, storage_path, mime_type')
      .eq('id', messageId)
      .single();
      
    if (messageError || !message) {
      throw new Error(`Message not found: ${messageError?.message || 'No data returned'}`);
    }
    
    if (!message.storage_path || !message.mime_type) {
      throw new Error('Message has no storage_path or mime_type');
    }
    
    // Validate the MIME type
    const validatedMimeType = xdelo_validateMimeType(message.mime_type) ? 
      message.mime_type : 'application/octet-stream';
    
    // Determine proper content disposition
    const isViewable = xdelo_isViewableMimeType(validatedMimeType);
    const contentDisposition = isViewable ? 'inline' : 'attachment';
    
    // Download the file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('telegram-media')
      .download(message.storage_path);
      
    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }
    
    // Get upload options with proper content disposition
    const uploadOptions = xdelo_getUploadOptions(validatedMimeType);
    
    // Re-upload with correct content disposition
    const { error: uploadError } = await supabase.storage
      .from('telegram-media')
      .upload(message.storage_path, fileData, { ...uploadOptions, upsert: true });
      
    if (uploadError) {
      throw new Error(`Failed to upload file: ${uploadError.message}`);
    }
    
    // Generate appropriate public URL
    const publicUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/telegram-media/${message.storage_path}`;
    const displayUrl = isViewable ? `${publicUrl}?download=false` : publicUrl;
    
    // Update the message with the new content disposition
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        mime_type: validatedMimeType,
        mime_type_verified: true,
        content_disposition: contentDisposition,
        public_url: displayUrl,
        storage_metadata: uploadOptions.metadata,
        storage_exists: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);
      
    if (updateError) {
      throw new Error(`Failed to update message: ${updateError.message}`);
    }
    
    return {
      success: true,
      message: 'Successfully fixed content disposition',
      data: {
        messageId: message.id,
        contentDisposition,
        mimeType: validatedMimeType,
        publicUrl: displayUrl
      }
    };
  } catch (error) {
    console.error('Error fixing content disposition:', error);
    return {
      success: false,
      message: error.message || 'Unknown error'
    };
  }
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { messageId, messageIds, limit = 100 } = await req.json();
    
    // Process multiple messages
    if (messageIds && Array.isArray(messageIds) && messageIds.length > 0) {
      const results = [];
      for (const id of messageIds) {
        const result = await fixContentDisposition(id);
        results.push({
          messageId: id,
          ...result
        });
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          results
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Process a single message
    else if (messageId) {
      const result = await fixContentDisposition(messageId);
      
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Process messages in bulk
    else {
      // Query messages that need fixing
      const { data: messages, error: queryError } = await supabase
        .from('messages')
        .select('id')
        .is('storage_exists', true)
        .is('mime_type_verified', null)
        .limit(limit);
        
      if (queryError) {
        throw new Error(`Failed to query messages: ${queryError.message}`);
      }
      
      if (!messages || messages.length === 0) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'No messages need fixing',
            count: 0
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Process each message
      const results = [];
      for (const message of messages) {
        const result = await fixContentDisposition(message.id);
        results.push({
          messageId: message.id,
          ...result
        });
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          count: messages.length,
          results
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message || 'Unknown error'
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
