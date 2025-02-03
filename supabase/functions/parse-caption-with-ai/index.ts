import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParsedContent {
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  purchase_date?: string;
  quantity?: number;
  notes?: string;
  parsing_metadata?: {
    method: 'manual' | 'ai' | 'hybrid';
    confidence: number;
    fallbacks_used?: string[];
    quantity_confidence?: number;
    quantity_method?: string;
    quantity_is_approximate?: boolean;
    quantity_unit?: string;
    quantity_original?: string;
  };
}

interface QuantityParseResult {
  value: number;
  confidence: number;
  unit?: string;
  original_text: string;
  method: 'explicit' | 'numeric' | 'text' | 'fallback';
  is_approximate: boolean;
}

const QUANTITY_PATTERNS = {
  STANDARD_X: /[x×]\s*(\d+)/i,
  WITH_UNITS: /(\d+)\s*(pc|pcs|pieces?|units?|qty)/i,
  PREFIX_QTY: /(?:qty|quantity)\s*:?\s*(\d+)/i,
  PARENTHESES: /\((?:qty|quantity|x|×)?\s*(\d+)\s*(?:pc|pcs|pieces?)?\)/i,
  NUMBER_PREFIX: /^(\d+)\s*[x×]/i,
  TEXT_NUMBERS: /\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/i,
  APPROXIMATE: /(?:about|approximately|approx|~)\s*(\d+)/i
};

const TEXT_TO_NUMBER: { [key: string]: number } = {
  'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
  'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
};

const UNIT_NORMALIZATIONS: { [key: string]: string } = {
  'pc': 'piece',
  'pcs': 'pieces',
  'piece': 'piece',
  'pieces': 'pieces',
  'unit': 'unit',
  'units': 'units',
  'qty': 'quantity'
};

function parseQuantity(text: string): QuantityParseResult | null {
  console.log("Parsing quantity from:", text);
  
  function validateQuantity(value: number): number | null {
    if (isNaN(value) || value <= 0 || value > 9999) return null;
    return value;
  }

  const patterns: [RegExp, string, number][] = [
    [QUANTITY_PATTERNS.STANDARD_X, 'explicit', 0.9],
    [QUANTITY_PATTERNS.WITH_UNITS, 'explicit', 0.9],
    [QUANTITY_PATTERNS.PREFIX_QTY, 'explicit', 0.85],
    [QUANTITY_PATTERNS.PARENTHESES, 'explicit', 0.8],
    [QUANTITY_PATTERNS.NUMBER_PREFIX, 'explicit', 0.8],
    [QUANTITY_PATTERNS.APPROXIMATE, 'explicit', 0.7],
    [QUANTITY_PATTERNS.TEXT_NUMBERS, 'text', 0.6]
  ];

  for (const [pattern, method, confidence] of patterns) {
    const match = text.match(pattern);
    if (match) {
      let value: number;
      let is_approximate = false;

      if (method === 'text') {
        value = TEXT_TO_NUMBER[match[1].toLowerCase()];
      } else {
        value = parseInt(match[1]);
        is_approximate = text.includes('~') || 
                        text.toLowerCase().includes('about') || 
                        text.toLowerCase().includes('approx');
      }

      const validatedValue = validateQuantity(value);
      if (validatedValue === null) continue;

      let unit: string | undefined;
      const unitMatch = text.match(/(?:pc|pcs|pieces?|units?)/i);
      if (unitMatch) {
        unit = UNIT_NORMALIZATIONS[unitMatch[0].toLowerCase()];
      }

      return {
        value: validatedValue,
        confidence: is_approximate ? confidence * 0.8 : confidence,
        unit,
        original_text: match[0],
        method: method as 'explicit' | 'numeric' | 'text' | 'fallback',
        is_approximate
      };
    }
  }

  const numberMatch = text.match(/\b(\d+)\b/);
  if (numberMatch) {
    const value = validateQuantity(parseInt(numberMatch[1]));
    if (value !== null) {
      return {
        value,
        confidence: 0.4,
        original_text: numberMatch[0],
        method: 'fallback',
        is_approximate: false
      };
    }
  }

  return null;
}

function manualParse(caption: string): ParsedContent {
  console.log("Starting enhanced manual parsing for:", caption);
  const result: ParsedContent = {};
  const fallbacks_used: string[] = [];

  const hashIndex = caption.indexOf('#');
  if (hashIndex > 0) {
    result.product_name = caption.substring(0, hashIndex).trim();
  } else {
    result.product_name = caption.trim();
    fallbacks_used.push('no_hash_product_name');
  }

  const codeMatch = caption.match(/#([A-Za-z0-9-]+)/);
  if (codeMatch) {
    result.product_code = codeMatch[1];
    
    const vendorMatch = result.product_code.match(/^([A-Za-z]{1,4})/);
    if (vendorMatch) {
      result.vendor_uid = vendorMatch[1];
      
      const dateStr = result.product_code.substring(vendorMatch[1].length);
      if (/^\d{5,6}$/.test(dateStr)) {
        try {
          const paddedDate = dateStr.length === 5 ? '0' + dateStr : dateStr;
          const month = paddedDate.substring(0, 2);
          const day = paddedDate.substring(2, 4);
          const year = '20' + paddedDate.substring(4, 6);
          
          const date = new Date(`${year}-${month}-${day}`);
          if (!isNaN(date.getTime()) && date <= new Date()) {
            result.purchase_date = `${year}-${month}-${day}`;
          } else {
            fallbacks_used.push('invalid_date');
          }
        } catch (error) {
          console.error("Date parsing error:", error);
          fallbacks_used.push('date_parse_error');
        }
      } else if (dateStr) {
        result.product_code = `${result.vendor_uid}-${dateStr}`;
        fallbacks_used.push('non_date_product_code');
      }
    }
  }

  const quantityResult = parseQuantity(caption);
  if (quantityResult) {
    result.quantity = quantityResult.value;
    result.parsing_metadata = {
      method: 'manual',
      confidence: quantityResult.confidence,
      quantity_confidence: quantityResult.confidence,
      quantity_method: quantityResult.method,
      quantity_is_approximate: quantityResult.is_approximate,
      quantity_unit: quantityResult.unit,
      quantity_original: quantityResult.original_text,
      fallbacks_used
    };
  }

  const notesMatch = caption.match(/\((.*?)\)/);
  if (notesMatch) {
    result.notes = notesMatch[1].trim();
  } else {
    let remainingText = caption
      .replace(/#[A-Za-z0-9-]+/, '')
      .replace(/x\s*\d+/i, '')
      .replace(result.product_name || '', '')
      .trim()
      .replace(/^[-,\s]+/, '')
      .replace(/[-,\s]+$/, '');
    
    if (remainingText) {
      result.notes = remainingText;
      fallbacks_used.push('implicit_notes');
    }
  }

  if (!result.parsing_metadata) {
    result.parsing_metadata = {
      method: 'manual',
      confidence: fallbacks_used.length ? 0.7 : 0.9,
      fallbacks_used: fallbacks_used.length ? fallbacks_used : undefined
    };
  }

  console.log("Enhanced manual parsing result:", result);
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
        {
          role: 'system',
          content: `You are a specialized product information extractor. Extract the following from the caption:
          1. Product Name: Text before '#'
          2. Product Code: Full code after '#'
          3. Vendor UID: Letters at start of product code
          4. Purchase Date: Convert mmDDyy or mDDyy to YYYY-MM-DD
          5. Quantity: Look for numbers after 'x' or in units
          6. Notes: Text in parentheses or remaining info
          
          Return a JSON object with these fields and include confidence levels.`
        },
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
  const aiResult = JSON.parse(data.choices[0].message.content);

  return {
    ...aiResult,
    parsing_metadata: {
      method: 'ai',
      confidence: 0.8,
      fallbacks_used: []
    }
  };
}

function validateParsedContent(content: ParsedContent): boolean {
  const hasRequiredFields = !!(
    content.product_name &&
    content.product_name !== 'Untitled Product' &&
    content.product_code &&
    content.vendor_uid
  );

  const hasValidDate = !content.purchase_date || (
    new Date(content.purchase_date) <= new Date() &&
    !isNaN(new Date(content.purchase_date).getTime())
  );

  const hasValidQuantity = !content.quantity || (
    content.quantity > 0 && 
    content.quantity < 10000
  );

  return hasRequiredFields && hasValidDate && hasValidQuantity;
}

function mergeResults(manual: ParsedContent, ai: ParsedContent): ParsedContent {
  const merged = {
    product_name: manual.product_name || ai.product_name || 'Untitled Product',
    product_code: manual.product_code || ai.product_code,
    vendor_uid: manual.vendor_uid || ai.vendor_uid,
    purchase_date: manual.purchase_date || ai.purchase_date,
    quantity: manual.quantity || ai.quantity,
    notes: manual.notes || ai.notes,
    parsing_metadata: {
      method: 'hybrid',
      confidence: Math.max(
        manual.parsing_metadata?.confidence || 0,
        ai.parsing_metadata?.confidence || 0
      ),
      fallbacks_used: [
        ...(manual.parsing_metadata?.fallbacks_used || []),
        ...(ai.parsing_metadata?.fallbacks_used || [])
      ],
      quantity_confidence: manual.parsing_metadata?.quantity_confidence || ai.parsing_metadata?.quantity_confidence,
      quantity_method: manual.parsing_metadata?.quantity_method || ai.parsing_metadata?.quantity_method,
      quantity_is_approximate: manual.parsing_metadata?.quantity_is_approximate || ai.parsing_metadata?.quantity_is_approximate,
      quantity_unit: manual.parsing_metadata?.quantity_unit || ai.parsing_metadata?.quantity_unit,
      quantity_original: manual.parsing_metadata?.quantity_original || ai.parsing_metadata?.quantity_original
    }
  };

  return merged;
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

    const manualResult = manualParse(caption);
    console.log('Manual parsing result:', manualResult);

    let finalResult = manualResult;

    if (!validateParsedContent(manualResult)) {
      console.log('Manual parsing incomplete, attempting AI parsing');
      try {
        const aiResult = await aiParse(caption);
        console.log('AI parsing result:', aiResult);
        finalResult = mergeResults(manualResult, aiResult);
        console.log('Merged parsing result:', finalResult);
      } catch (aiError) {
        console.error('AI parsing failed:', aiError);
      }
    }

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
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to parse caption or update message'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});