
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

// Types
type ProcessingState = 'initialized' | 'pending' | 'processing' | 'completed' | 'error' | 'no_caption';

interface AnalyzedContent {
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  purchase_date?: string;
  quantity?: number;
  notes?: string;
  parsing_metadata?: {
    method: 'manual';
    timestamp: string;
    needs_ai_analysis?: boolean;
  };
  sync_metadata?: {
    sync_source_message_id?: string;
    media_group_id?: string;
  };
}

interface MessageUpdate {
  analyzed_content: AnalyzedContent | null;
  processing_state: ProcessingState;
  processing_completed_at?: string;
  is_original_caption?: boolean;
  group_caption_synced?: boolean;
  message_caption_id?: string;
  error_message?: string;
  last_error_at?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Manual parsing function
function extractProductInfo(caption: string): AnalyzedContent {
  console.log('[parse-caption] Starting manual parsing of caption:', { caption_length: caption.length });
  
  const result: AnalyzedContent = {};
  
  // Split caption into lines
  const lines = caption.split('\n').map(line => line.trim());
  console.log('[parse-caption] Extracted lines:', { line_count: lines.length });

  // Regular expressions for matching
  const vendorRegex = /^(?:vendor|supplier|from|by|uid):\s*(.+)/i;
  const productCodeRegex = /^(?:code|product|item|sku|id):\s*(.+)/i;
  const quantityRegex = /^(?:qty|quantity|amount|pcs):\s*(\d+)/i;
  const dateRegex = /^(?:date|purchased|bought|received):\s*(.+)/i;

  let hasFoundVendor = false;
  let hasFoundCode = false;

  for (const line of lines) {
    if (!hasFoundVendor && vendorRegex.test(line)) {
      const match = line.match(vendorRegex);
      if (match) {
        result.vendor_uid = match[1].trim();
        hasFoundVendor = true;
        console.log('[parse-caption] Found vendor:', { vendor_uid: result.vendor_uid });
      }
    }
    
    if (!hasFoundCode && productCodeRegex.test(line)) {
      const match = line.match(productCodeRegex);
      if (match) {
        result.product_code = match[1].trim();
        hasFoundCode = true;
        console.log('[parse-caption] Found product code:', { product_code: result.product_code });
      }
    }

    const qtyMatch = line.match(quantityRegex);
    if (qtyMatch) {
      result.quantity = parseInt(qtyMatch[1], 10);
      console.log('[parse-caption] Found quantity:', { quantity: result.quantity });
    }

    const dateMatch = line.match(dateRegex);
    if (dateMatch) {
      result.purchase_date = dateMatch[1].trim();
      console.log('[parse-caption] Found purchase date:', { purchase_date: result.purchase_date });
    }
  }

  // Store remaining lines as notes if they contain valuable information
  const notes = lines.filter(line => 
    !vendorRegex.test(line) && 
    !productCodeRegex.test(line) && 
    !quantityRegex.test(line) && 
    !dateRegex.test(line) &&
    line.length > 0
  ).join('\n');

  if (notes) {
    result.notes = notes;
    console.log('[parse-caption] Extracted notes:', { notes_length: notes.length });
  }

  // Add parsing metadata
  result.parsing_metadata = {
    method: 'manual',
    timestamp: new Date().toISOString(),
    needs_ai_analysis: !hasFoundVendor || !hasFoundCode
  };

  console.log('[parse-caption] Parsing completed:', { 
    has_vendor: hasFoundVendor,
    has_code: hasFoundCode,
    needs_ai: result.parsing_metadata.needs_ai_analysis
  });

  return result;
}

async function handleMediaGroupSync(
  supabase: any,
  messageId: string,
  media_group_id: string,
  analyzedContent: AnalyzedContent
): Promise<void> {
  console.log('[media-group-sync] Starting sync process:', { messageId, media_group_id });

  try {
    // Get group statistics
    const { data: groupStats, error: statsError } = await supabase
      .from('messages')
      .select('id, created_at')
      .eq('media_group_id', media_group_id);

    if (statsError) {
      throw new Error(`Failed to get group statistics: ${statsError.message}`);
    }

    const groupFirstTime = groupStats.length > 0 
      ? new Date(Math.min(...groupStats.map(m => new Date(m.created_at).getTime())))
      : new Date();
    const groupLastTime = groupStats.length > 0
      ? new Date(Math.max(...groupStats.map(m => new Date(m.created_at).getTime())))
      : new Date();

    console.log('[media-group-sync] Group statistics:', {
      total_messages: groupStats.length,
      first_message: groupFirstTime,
      last_message: groupLastTime
    });

    // Check for existing analyzed content
    const { data: existingAnalyzed, error: existingError } = await supabase
      .from('messages')
      .select('analyzed_content, id')
      .eq('media_group_id', media_group_id)
      .neq('id', messageId)
      .not('analyzed_content', 'is', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existingError) {
      throw new Error(`Failed to check existing analyzed content: ${existingError.message}`);
    }

    if (existingAnalyzed?.analyzed_content) {
      console.log('[media-group-sync] Found existing analyzed content:', { 
        source_message_id: existingAnalyzed.id 
      });

      // Sync this message with existing analyzed content
      const syncedContent: AnalyzedContent = {
        ...existingAnalyzed.analyzed_content,
        sync_metadata: {
          sync_source_message_id: existingAnalyzed.id,
          media_group_id
        }
      };

      const { error: syncError } = await supabase
        .from('messages')
        .update({
          analyzed_content: syncedContent,
          processing_state: 'completed',
          processing_completed_at: new Date().toISOString(),
          is_original_caption: false,
          group_caption_synced: true,
          message_caption_id: existingAnalyzed.id,
          group_first_message_time: groupFirstTime.toISOString(),
          group_last_message_time: groupLastTime.toISOString()
        })
        .eq('id', messageId);

      if (syncError) {
        throw new Error(`Failed to sync with existing content: ${syncError.message}`);
      }

      console.log('[media-group-sync] Successfully synced with existing content');
    } else {
      console.log('[media-group-sync] No existing content found, syncing group to this message');

      // This is the first analyzed content, sync others to this one
      const syncedContent: AnalyzedContent = {
        ...analyzedContent,
        sync_metadata: {
          sync_source_message_id: messageId,
          media_group_id
        }
      };

      const { error: groupSyncError } = await supabase
        .from('messages')
        .update({
          analyzed_content: syncedContent,
          processing_state: 'completed',
          processing_completed_at: new Date().toISOString(),
          is_original_caption: false,
          group_caption_synced: true,
          message_caption_id: messageId,
          group_first_message_time: groupFirstTime.toISOString(),
          group_last_message_time: groupLastTime.toISOString()
        })
        .eq('media_group_id', media_group_id)
        .neq('id', messageId);

      if (groupSyncError) {
        throw new Error(`Failed to sync group to this message: ${groupSyncError.message}`);
      }

      console.log('[media-group-sync] Successfully synced group to this message');
    }
  } catch (error) {
    console.error('[media-group-sync] Error during sync:', error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messageId, caption, media_group_id, correlationId } = await req.json();
    
    if (!messageId || !caption) {
      throw new Error('Missing required parameters: messageId and caption');
    }

    console.log('[parse-caption] Starting analysis:', { 
      messageId, 
      media_group_id, 
      caption_length: caption?.length,
      correlation_id: correlationId 
    });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Set state to processing
    const { error: stateError } = await supabase
      .from('messages')
      .update({ 
        processing_state: 'processing',
        processing_started_at: new Date().toISOString()
      })
      .eq('id', messageId);

    if (stateError) {
      throw new Error(`Failed to update processing state: ${stateError.message}`);
    }

    // Perform manual parsing
    const parsedContent = extractProductInfo(caption);

    // Base message update
    const baseUpdate: MessageUpdate = {
      analyzed_content: parsedContent,
      processing_state: 'completed',
      processing_completed_at: new Date().toISOString(),
      is_original_caption: true
    };

    // Update the message
    const { error: updateError } = await supabase
      .from('messages')
      .update(baseUpdate)
      .eq('id', messageId);

    if (updateError) {
      throw new Error(`Failed to update message: ${updateError.message}`);
    }

    // Handle media group synchronization if needed
    if (media_group_id) {
      await handleMediaGroupSync(supabase, messageId, media_group_id, parsedContent);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        needs_ai_analysis: parsedContent.parsing_metadata?.needs_ai_analysis 
      }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[parse-caption] Error:', error);
    
    // Try to update message to error state
    try {
      const { messageId } = await req.json();
      if (messageId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const errorUpdate: MessageUpdate = {
          analyzed_content: null,
          processing_state: 'error',
          error_message: error.message,
          processing_completed_at: new Date().toISOString(),
          last_error_at: new Date().toISOString()
        };

        await supabase
          .from('messages')
          .update(errorUpdate)
          .eq('id', messageId);

        console.log('[parse-caption] Updated message to error state:', { messageId, error: error.message });
      }
    } catch (updateError) {
      console.error('[parse-caption] Error updating error state:', updateError);
    }
    
    return new Response(
      JSON.stringify({ error: error.message }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
