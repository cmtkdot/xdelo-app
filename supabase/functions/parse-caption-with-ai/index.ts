import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are a specialized product information extractor. Your task is to analyze captions and extract structured product information following these rules:

1. Product Name: Text before '#' (required)
2. Product Code: Full code after '#' including vendor and date
3. Vendor UID: 1-4 letters after '#' before any numbers
4. Purchase Date: Convert date format:
   - 6 digits (mmDDyy) -> YYYY-MM-DD
   - 5 digits (mDDyy) -> YYYY-MM-DD (add leading zero)
5. Quantity: Number after 'x'
6. Notes: Any additional info in parentheses or unstructured text`;

interface ParsedContent {
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  purchase_date?: string;
  quantity?: number;
  notes?: string;
}

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
  const codeMatch = caption.match(/#([A-Za-z0-9]+)/);
  if (codeMatch) {
    result.product_code = codeMatch[1];
    
    // Vendor (letters at start of product code)
    const vendorMatch = result.product_code.match(/^([A-Za-z]{1,4})/);
    if (vendorMatch) {
      result.vendor_uid = vendorMatch[1];
      
      // Date (digits after vendor)
      const dateStr = result.product_code.substring(vendorMatch[1].length);
      result.purchase_date = parseDate(dateStr);
    }
  }

  // Quantity (x followed by number)
  const quantityMatch = caption.match(/x\s*(\d+)/i);
  if (quantityMatch) {
    result.quantity = parseInt(quantityMatch[1]);
  }

  // Notes (text in parentheses or remaining text)
  const notesMatch = caption.match(/\((.*?)\)/);
  if (notesMatch) {
    result.notes = notesMatch[1].trim();
  } else {
    const remainingText = caption
      .replace(/#[A-Za-z0-9]+/, '')
      .replace(/x\s*\d+/, '')
      .replace(productNameMatch, '')
      .trim();
    
    if (remainingText) {
      result.notes = remainingText;
    }
  }

  return result;
}

async function aiParse(caption: string): Promise<ParsedContent> {
  console.log('Attempting AI analysis for caption:', caption);
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
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
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
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

  return {
    product_name: result.product_name,
    product_code: result.product_code,
    vendor_uid: result.vendor_uid,
    purchase_date: result.purchase_date ? parseDate(result.purchase_date) : undefined,
    quantity: typeof result.quantity === 'number' ? result.quantity : undefined,
    notes: result.notes
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

function validateParsedContent(content: ParsedContent): boolean {
  return !!(
    content.product_name &&
    content.product_name !== 'Untitled Product' &&
    content.product_code &&
    content.vendor_uid
  );
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message_id, caption } = await req.json();
    console.log(`Processing caption parsing for message ${message_id}`);

    if (!caption) {
      throw new Error('No caption provided for parsing');
    }

    // Step 1: Manual parsing attempt
    const manualResult = manualParse(caption);
    console.log('Manual parsing result:', manualResult);

    let finalResult = manualResult;

    // Step 2: Check if manual parsing was successful
    if (!validateParsedContent(manualResult)) {
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

    // Update the message with parsed content
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { error: updateError } = await supabase
      .from('messages')
      .update({
        parsed_content: finalResult,
        processing_state: 'completed'
      })
      .eq('id', message_id);

    if (updateError) throw updateError;

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