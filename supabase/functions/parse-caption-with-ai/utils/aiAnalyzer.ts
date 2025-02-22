/// <reference types="@deno/types" />
/// <reference lib="deno.ns" />
/// <reference lib="dom" />

import { ParsedContent, ProcessingState, SupabaseClient, DatabaseMessage, GroupMetadata, StateLogEntry, SupabaseResponse } from '../types.ts';
import { manualParse } from "./manualParser.ts";

const SYSTEM_PROMPT = `You are a specialized product information extractor. Extract structured information following these rules:

1. Required Structure:
   - product_name: Text before '#', REQUIRED, must always be present
   - product_code: Value after '#' (format: #[vendor_uid][purchasedate])
   - vendor_uid: 1-4 letters after '#' before numeric date
   - purchase_date: Convert mmDDyy/mDDyy to YYYY-MM-DD format (add leading zero for 5-digit dates)
   - quantity: Integer after 'x'
   - notes: Any other values (in parentheses or remaining text)

2. Parsing Rules:
   - Dates: 
     * 6 digits: mmDDyy (120523 → 2023-12-05)
     * 5 digits: mDDyy (31524 → 2024-03-15)
   - Vendor IDs:
     * First 1-4 letters followed by optional valid date digits
     * If invalid date digits, append with hyphen (CHAD123 → CHAD-123)

3. IMPORTANT: Your response must be valid JSON matching this exact format:
{
  "product_name": string,
  "product_code": string | null,
  "vendor_uid": string | null,
  "purchase_date": string | null,
  "quantity": number | null,
  "notes": string | null
}`;

function calculateConfidence(result: ParsedContent): number {
  let score = 0.5; // Base score

  // Product name is required
  if (result.product_name && result.product_name !== 'Untitled Product') {
    score += 0.2;
  }

  // Product code and vendor validation
  if (result.product_code && result.vendor_uid) {
    const validCode = /^[A-Z]{1,4}\d{5,6}$/.test(result.product_code);
    score += validCode ? 0.1 : -0.1;
  }

  // Date validation
  if (result.purchase_date) {
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(result.purchase_date);
    score += validDate ? 0.1 : -0.1;
  }

  // Quantity validation
  if (typeof result.quantity === 'number' && result.quantity > 0) {
    score += 0.1;
  }

  return Math.max(0.1, Math.min(1, score));
}

async function syncMediaGroup(
  supabase: SupabaseClient,
  messageId: string,
  mediaGroupId: string | null,
  analyzedContent: ParsedContent
) {
  if (!mediaGroupId) return;

  try {
    console.log('🔄 Starting media group sync:', { messageId, mediaGroupId });

    // Get messages in the group
    const { data: groupMessages, error: fetchError } = await supabase
      .from('messages')
      .select('id, processing_state')
      .eq('media_group_id', mediaGroupId);

    if (fetchError) throw fetchError;
    if (!groupMessages) throw new Error('No messages found');

    // Calculate group metadata
    const groupMetadata: GroupMetadata = {
      first_message_time: groupMessages.reduce((min, msg) => 
        !min || msg.created_at < min ? msg.created_at : min, groupMessages[0].created_at),
      last_message_time: groupMessages.reduce((max, msg) => 
        !max || msg.created_at > max ? msg.created_at : max, groupMessages[0].created_at),
      message_count: groupMessages.length
    };

    // Update each message in the group
    const updateQuery = supabase
      .from('messages')
      .update({
        analyzed_content: analyzedContent,
        processing_state: 'completed' as ProcessingState,
        processing_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    for (const msg of groupMessages) {
      if (msg.id !== messageId) {
        const { error: msgError } = await updateQuery.eq('id', msg.id);
        if (msgError) {
          console.error(`Failed to update message ${msg.id}:`, msgError);
        }
      }
    }

    // Update source message metadata
    const { error: sourceError } = await supabase
      .from('messages')
      .update({
        group_first_message_time: groupMetadata.first_message_time,
        group_last_message_time: groupMetadata.last_message_time,
        group_message_count: groupMetadata.message_count,
        group_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);

    if (sourceError) throw sourceError;

    // Log state changes
    const stateLogEntries = groupMessages
      .filter(msg => msg.id !== messageId)
      .map(msg => ({
        message_id: msg.id,
        previous_state: msg.processing_state as ProcessingState,
        new_state: 'completed' as ProcessingState,
        changed_at: new Date().toISOString(),
        metadata: {
          sync_type: 'media_group',
          source_message_id: messageId
        }
      } as StateLogEntry));

    if (stateLogEntries.length > 0) {
      const { error: logError } = await supabase
        .from('message_state_logs')
        .insert(stateLogEntries);

      if (logError) {
        console.error('Warning: Failed to log state changes:', logError);
      }
    }

    console.log('✅ Successfully synced media group:', { messageId, mediaGroupId });
  } catch (error) {
    console.error('❌ Error syncing media group:', error);
    throw error;
  }
}

function extractAnalyzedFields(analyzedContent: ParsedContent) {
  try {
    return {
      product_name: analyzedContent?.product_name || null,
      product_code: analyzedContent?.product_code || null,
      vendor_uid: analyzedContent?.vendor_uid || null,
      purchase_date: analyzedContent?.purchase_date || null,
      quantity: typeof analyzedContent?.quantity === 'number' ? 
        Math.max(0, Math.floor(analyzedContent.quantity)) : null,
      notes: analyzedContent?.notes || null,
      confidence: analyzedContent?.parsing_metadata?.confidence || 0,
      method: analyzedContent?.parsing_metadata?.method || 'unknown',
      timestamp: analyzedContent?.parsing_metadata?.timestamp || new Date().toISOString()
    };
  } catch (error) {
    console.error('Error extracting analyzed fields:', error);
    return null;
  }
}

export async function analyzeCaption(
  caption: string,
  messageId: string,
  mediaGroupId: string | null,
  supabaseClient: SupabaseClient
): Promise<ParsedContent> {
  try {
    console.log("Starting caption analysis:", { caption, messageId, mediaGroupId });

    // First try manual parsing
    const manualResult = await manualParse(caption);
    if (manualResult?.product_name && manualResult.product_name !== 'Untitled Product') {
      console.log('Successfully parsed caption manually:', manualResult);
      
      // Update message with manual result
      const { error: updateError } = await supabaseClient
        .from('messages')
        .update({
          analyzed_content: manualResult,
          processing_state: 'completed' as ProcessingState,
          processing_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId);

      if (updateError) throw updateError;

      // Sync media group if needed
      if (mediaGroupId) {
        await syncMediaGroup(supabaseClient, messageId, mediaGroupId, manualResult);
      }

      return manualResult;
    }

    // Fallback to AI analysis
    console.log('Manual parsing incomplete, attempting AI analysis');
    const openAIApiKey = Deno?.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { 
            role: 'user', 
            content: `Please analyze this product caption, preserving all emojis:\n${caption}`
          }
        ],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    let result;
    try {
      const content = data.choices[0].message.content;
      result = typeof content === 'string' ? JSON.parse(content) : content;
    } catch (e) {
      console.error('Failed to parse GPT response:', e);
      throw new Error('Invalid response format from GPT');
    }

    // Clean up and validate the result
    const cleanResult: ParsedContent = {
      product_name: result.product_name || 'Untitled Product',
      product_code: result.product_code,
      vendor_uid: result.vendor_uid,
      purchase_date: result.purchase_date,
      quantity: typeof result.quantity === 'number' ? result.quantity : undefined,
      notes: result.notes,
      parsing_metadata: {
        method: 'ai',
        confidence: calculateConfidence(result),
        timestamp: new Date().toISOString()
      }
    };

    console.log('AI analysis result:', cleanResult);

    // After successful AI analysis, update message and sync group
    const { error: updateError } = await supabaseClient
      .from('messages')
      .update({
        analyzed_content: cleanResult,
        processing_state: 'completed' as ProcessingState,
        processing_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);

    if (updateError) throw updateError;

    // Sync media group if needed
    if (mediaGroupId) {
      await syncMediaGroup(supabaseClient, messageId, mediaGroupId, cleanResult);
    }

    return cleanResult;

  } catch (error) {
    console.error('Error analyzing caption:', error);
    
    // Update message state to error
    try {
      await supabaseClient
        .from('messages')
        .update({
          processing_state: 'error' as ProcessingState,
          error_message: error instanceof Error ? error.message : 'Unknown error',
          last_error_at: new Date().toISOString()
        })
        .eq('id', messageId);
    } catch (updateError) {
      console.error('Failed to update error state:', updateError);
    }

    // Return basic info even if analysis fails
    return {
      product_name: caption.split('\n')[0]?.trim() || 'Untitled Product',
      parsing_metadata: {
        method: 'ai',
        confidence: 0.1,
        timestamp: new Date().toISOString(),
        fallbacks_used: ['error_fallback']
      }
    };
  }
}

function formatFlavorList(caption: string): string {
  try {
    const lines = caption.split('\n');
    const flavorSection = lines
      .slice(lines.findIndex(line => line.toLowerCase().includes('flavor')) + 1)
      .filter(line => line.trim() && !line.toLowerCase().includes('flavor'));

    if (flavorSection.length === 0) {
      return '';
    }

    return flavorSection.join('\n').trim();
  } catch (error) {
    console.error('Error formatting flavor list:', error);
    return '';
  }
}

// For Deno environment in edge functions
declare global {
  interface Window {
    Deno: {
      env: {
        get(key: string): string | undefined;
      };
    };
  }
}