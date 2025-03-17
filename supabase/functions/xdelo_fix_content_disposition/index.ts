
import { corsHeaders } from '../_shared/cors.ts';
import { supabaseClient } from '../_shared/supabase.ts';
import { xdelo_isViewableMimeType } from '../_shared/mediaUtils.ts';
import { Message } from '../_shared/types.ts';

// Set CORS headers for browser API requests
const corsHeadersObj = {
  ...corsHeaders,
  'Content-Type': 'application/json',
};

// Main handler for HTTP requests
Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeadersObj,
    });
  }

  try {
    // Parse request body
    const { messageId } = await req.json();
    
    if (!messageId) {
      throw new Error('messageId is required');
    }
    
    // Get the message
    const { data: message, error: messageError } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();
      
    if (messageError || !message) {
      throw new Error(`Failed to fetch message: ${messageError?.message || 'Message not found'}`);
    }
    
    const result = await fixContentDisposition(message);
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: corsHeadersObj,
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      status: 400,
      headers: corsHeadersObj
    });
  }
});

// Fix content disposition for a message
async function fixContentDisposition(message: Message): Promise<any> {
  if (!message.storage_path) {
    return {
      success: false,
      error: 'Message has no storage path'
    };
  }
  
  // Determine content disposition from MIME type
  const mimeType = message.mime_type || 'application/octet-stream';
  const isViewable = xdelo_isViewableMimeType(mimeType);
  const contentDisposition = isViewable ? 'inline' : 'attachment';
  
  try {
    // Update file metadata in storage
    const { error: updateError } = await supabaseClient.storage
      .from('telegram-media')
      .update(message.storage_path, new Blob([]), {
        contentType: mimeType,
        cacheControl: '3600',
        contentDisposition,
        upsert: false
      });
      
    if (updateError) {
      console.warn(`Storage metadata update failed: ${updateError.message}`, updateError);
      // Continue with database update even if storage update failed
    }
    
    // Update message in database
    const { error: dbError } = await supabaseClient
      .from('messages')
      .update({
        content_disposition: contentDisposition,
        mime_type_verified: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', message.id);
      
    if (dbError) {
      throw new Error(`Database update failed: ${dbError.message}`);
    }
    
    return {
      success: true,
      message: `Content disposition updated to ${contentDisposition}`,
      contentDisposition,
      mimeType
    };
  } catch (error) {
    console.error(`Error fixing content disposition for message ${message.id}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}
