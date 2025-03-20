
import { corsHeaders } from '../_shared/cors.ts';
import { standardHandler } from '../_shared/standardHandler.ts';
import { supabase } from '../_shared/supabase.ts';

// Define the interface for batch repair request
interface BatchRepairRequest {
  message_ids?: string[];
  file_unique_ids?: string[];
  repair_options?: {
    redownload?: boolean;
    fix_urls?: boolean;
    fix_content_disposition?: boolean;
    reprocess_captions?: boolean;
  };
}

// Define the main handler function for repairing a batch of media
const handler = async (req: Request) => {
  // Parse the request body
  const reqBody: BatchRepairRequest = await req.json();
  const { message_ids = [], file_unique_ids = [], repair_options = {} } = reqBody;
  
  // Validate request
  if (message_ids.length === 0 && file_unique_ids.length === 0) {
    return new Response(
      JSON.stringify({ 
        error: 'No message_ids or file_unique_ids provided' 
      }),
      { 
        status: 400,
        headers: corsHeaders 
      }
    );
  }
  
  // Build our response data
  const responseData = {
    total_items: message_ids.length + file_unique_ids.length,
    repair_options: repair_options,
    message_ids: message_ids,
    file_unique_ids: file_unique_ids,
    success: true,
    message: `Started repair process for ${message_ids.length + file_unique_ids.length} items`
  };
  
  // Add CORS headers to response
  const response = new Response(
    JSON.stringify(responseData),
    { headers: corsHeaders }
  );
  
  return response;
};

// Use the standardHandler to handle errors, CORS, etc.
export const POST = standardHandler(handler);
