import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParseRequest {
  message_id: string;
  media_group_id?: string;
  caption: string;
}

interface ParsedContent {
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  purchase_date?: string;
  quantity?: number;
  notes?: string;
}

const PATTERNS = {
  PRODUCT_CODE: /#([A-Za-z0-9-]+)/,
  VENDOR: /^([A-Za-z]{1,4})/,
  QUANTITY: /x\s*(\d+)(?!\d*\s*[a-zA-Z])/i,
  NOTES: /\((.*?)\)/,
};

function parseDate(dateStr: string): string | undefined {
  if (!dateStr) return undefined;
  if (dateStr.length < 5 || dateStr.length > 6) return undefined;

  const paddedDate = dateStr.length === 5 ? '0' + dateStr : dateStr;
  const month = paddedDate.substring(0, 2);
  const day = paddedDate.substring(2, 4);
  const year = '20' + paddedDate.substring(4, 6);

  const date = new Date(`${year}-${month}-${day}`);
  if (isNaN(date.getTime()) || date > new Date()) return undefined;

  return `${year}-${month}-${day}`;
}

function manualParse(caption: string): ParsedContent {
  console.log("Starting manual parsing for:", caption);
  const result: ParsedContent = {};

  // Product name (everything before #)
  const productNameMatch = caption.split('#')[0].trim();
  if (productNameMatch) {
    result.product_name = productNameMatch;
  }

  // Product code (everything after # including vendor and date)
  const codeMatch = caption.match(PATTERNS.PRODUCT_CODE);
  if (codeMatch) {
    result.product_code = codeMatch[1];
    
    // Vendor (letters at start of product code)
    const vendorMatch = result.product_code.match(PATTERNS.VENDOR);
    if (vendorMatch) {
      result.vendor_uid = vendorMatch[1].toUpperCase();
      
      // Date (digits after vendor)
      const dateStr = result.product_code.substring(vendorMatch[1].length);
      result.purchase_date = parseDate(dateStr);
    }
  }

  // Quantity (x followed by number)
  const quantityMatch = caption.match(PATTERNS.QUANTITY);
  if (quantityMatch) {
    const quantity = parseInt(quantityMatch[1], 10);
    if (!isNaN(quantity) && quantity > 0) {
      result.quantity = quantity;
    }
  }

  // Notes (text in parentheses or remaining text)
  const notesMatch = caption.match(PATTERNS.NOTES);
  if (notesMatch) {
    result.notes = notesMatch[1].trim();
  }

  console.log("Manual parsing result:", result);
  return result;
}

async function aiParse(caption: string): Promise<ParsedContent> {
  console.log('Attempting AI analysis for caption:', caption);
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAIApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const systemPrompt = `Extract product information from captions following these rules:
1. Product Name: Text before '#' (required)
2. Product Code: Full code after '#'
3. Vendor UID: 1-4 letters after '#' before numbers
4. Purchase Date: Convert MMDDYY or MDDYY to YYYY-MM-DD
5. Quantity: Number after 'x' (must be positive integer)
6. Notes: Text in parentheses

Example Input: "Blue Widget #ABC12345 x5 (new stock)"
Example Output: {
  "product_name": "Blue Widget",
  "product_code": "ABC12345",
  "vendor_uid": "ABC",
  "purchase_date": "2023-12-34",
  "quantity": 5,
  "notes": "new stock"
}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: caption }
      ],
      temperature: 0.3,
      max_tokens: 500
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  const result = JSON.parse(data.choices[0].message.content);

  // Validate and format AI results
  return {
    product_name: result.product_name,
    product_code: result.product_code,
    vendor_uid: result.vendor_uid?.toUpperCase(),
    purchase_date: result.purchase_date ? parseDate(result.purchase_date) : undefined,
    quantity: typeof result.quantity === 'number' && result.quantity > 0 ? result.quantity : undefined,
    notes: result.notes
  };
}

function validateParsedContent(content: ParsedContent): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!content.product_name) errors.push("Missing product name");
  if (!content.product_code) errors.push("Missing product code");
  if (!content.vendor_uid) errors.push("Missing vendor ID");
  if (!content.purchase_date) errors.push("Invalid or missing purchase date");
  
  if (content.quantity !== undefined && (isNaN(content.quantity) || content.quantity <= 0)) {
    errors.push("Invalid quantity");
  }

  return { 
    isValid: errors.length === 0,
    errors 
  };
}

function mergeResults(manual: ParsedContent, ai: ParsedContent): ParsedContent {
  return {
    product_name: manual.product_name || ai.product_name || 'Untitled Product',
    product_code: manual.product_code || ai.product_code,
    vendor_uid: manual.vendor_uid || ai.vendor_uid,
    purchase_date: manual.purchase_date || ai.purchase_date,
    quantity: manual.quantity || ai.quantity,
    notes: manual.notes || ai.notes
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message_id, media_group_id, caption } = await req.json() as ParseRequest;
    console.log(`Processing caption parsing for message ${message_id}`);

    if (!caption) {
      throw new Error('No caption provided for parsing');
    }

    // Step 1: Manual parsing attempt
    const manualResult = manualParse(caption);
    console.log('Manual parsing result:', manualResult);

    let finalResult = manualResult;
    const manualValidation = validateParsedContent(manualResult);

    // Step 2: If manual parsing was not fully successful, try AI parsing
    if (!manualValidation.isValid) {
      console.log('Manual parsing incomplete, attempting AI parsing');
      try {
        const aiResult = await aiParse(caption);
        console.log('AI parsing result:', aiResult);
        
        // Step 3: Merge results, preferring manual parsing results
        finalResult = mergeResults(manualResult, aiResult);
        console.log('Merged parsing result:', finalResult);
      } catch (aiError) {
        console.error('AI parsing failed:', aiError);
        // Continue with manual results if AI fails
      }
    }

    // Step 4: Update the message with parsed content
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Update the message with parsed content
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        parsed_content: finalResult,
        analyzed_content: finalResult, // Keep backward compatibility
        processing_state: 'completed'
      })
      .eq('id', message_id);

    if (updateError) throw updateError;

    // If this is part of a media group, sync the analysis
    if (media_group_id) {
      const { error: syncError } = await supabase.rpc('process_media_group_analysis', {
        p_message_id: message_id,
        p_media_group_id: media_group_id,
        p_analyzed_content: finalResult,
        p_processing_completed_at: new Date().toISOString()
      });

      if (syncError) throw syncError;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        parsed_content: finalResult 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error parsing caption:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});