
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";
import { handleError } from "../_shared/baseHandler.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Initialize Supabase client with service role key for admin access
const supabaseAdmin = createClient(supabaseUrl!, supabaseServiceRoleKey!);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify JWT token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt);
    
    if (authError || !user) {
      throw new Error('Invalid token');
    }

    // Parse request body
    const { messageId, caption, media_group_id, correlationId, is_forward } = await req.json();

    if (!messageId || !caption) {
      throw new Error('Missing required fields: messageId and caption are required');
    }

    console.log('🔄 Starting caption analysis', {
      messageId,
      correlationId,
      media_group_id,
      is_forward
    });

    // Call OpenAI for analysis
    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a product analysis assistant. Extract the following information from the caption:
              - product_name (text before '#')
              - product_code (text after '#')
              - vendor_uid (first 1-4 letters of product_code)
              - purchase_date (date portion from product_code in YYYY-MM-DD format)
              - quantity (number after 'x')
              - notes (any other relevant information)
              
              Format the response as a JSON object.`
          },
          {
            role: 'user',
            content: caption
          }
        ],
      }),
    });

    const aiResult = await openAiResponse.json();
    const analyzedContent = JSON.parse(aiResult.choices[0].message.content);

    console.log('✅ AI Analysis completed', {
      messageId,
      analyzedContent
    });

    // Update the message with analyzed content
    const { error: updateError } = await supabaseAdmin
      .from('messages')
      .update({
        analyzed_content: analyzedContent,
        processing_state: 'completed',
        processing_completed_at: new Date().toISOString()
      })
      .eq('id', messageId);

    if (updateError) {
      throw updateError;
    }

    // If part of a media group, update all related messages
    if (media_group_id) {
      console.log('🔄 Syncing media group', { media_group_id });
      
      const { error: groupUpdateError } = await supabaseAdmin
        .from('messages')
        .update({
          analyzed_content: analyzedContent,
          processing_state: 'completed',
          processing_completed_at: new Date().toISOString(),
          group_caption_synced: true
        })
        .eq('media_group_id', media_group_id)
        .neq('id', messageId); // Don't update the original message again

      if (groupUpdateError) {
        console.error('Error updating media group:', groupUpdateError);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return handleError(error);
  }
});
