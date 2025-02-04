import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalyzedContent {
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  purchase_date?: string;
  quantity?: number;
  notes?: string;
  parsing_metadata?: {
    method: 'manual' | 'ai' | 'hybrid';
    confidence: number;
    timestamp: string;
    fallbacks_used?: string[];
    reanalysis_attempted?: boolean;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      message_id,
      media_group_id,
      caption,
      correlation_id = crypto.randomUUID()
    } = await req.json();

    console.log('Processing content:', {
      message_id,
      media_group_id,
      caption,
      correlation_id
    });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get OpenAI API key
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // 1. First try manual parsing
    const manualResult = await parseManually(caption);
    let finalResult: AnalyzedContent | null = null;

    if (manualResult && isValidAnalysis(manualResult)) {
      console.log('Manual parsing successful:', manualResult);
      finalResult = {
        ...manualResult,
        parsing_metadata: {
          method: 'manual',
          confidence: 1.0,
          timestamp: new Date().toISOString()
        }
      };
    } else {
      // 2. Fallback to AI analysis
      console.log('Manual parsing incomplete, attempting AI analysis');
      const aiResult = await analyzeWithAI(caption, openAIApiKey);
      if (aiResult) {
        finalResult = {
          ...aiResult,
          parsing_metadata: {
            method: 'ai',
            confidence: 0.8,
            timestamp: new Date().toISOString()
          }
        };
      }
    }

    if (!finalResult) {
      throw new Error('Failed to analyze content');
    }

    // 3. Update the database with the analyzed content
    const { error: updateError } = await supabase.rpc(
      'sync_media_group_content',
      {
        p_message_id: message_id,
        p_media_group_id: media_group_id,
        p_analyzed_content: finalResult,
        p_correlation_id: correlation_id
      }
    );

    if (updateError) {
      console.error('Error updating content:', updateError);
      throw updateError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        analyzed_content: finalResult,
        correlation_id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error processing content:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function parseManually(text: string): Promise<AnalyzedContent | null> {
  if (!text) return null;

  const result: AnalyzedContent = {};

  // Product name (everything before #)
  const productNameMatch = text.split('#')[0].trim();
  if (productNameMatch) {
    result.product_name = productNameMatch;
  }

  // Product code and vendor
  const codeMatch = text.match(/#([A-Za-z0-9-]+)/);
  if (codeMatch) {
    result.product_code = codeMatch[1];
    
    const vendorMatch = result.product_code.match(/^([A-Za-z]{1,4})/);
    if (vendorMatch) {
      result.vendor_uid = vendorMatch[1].toUpperCase();
      
      // Parse date from product code
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
          }
        } catch (error) {
          console.error("Date parsing error:", error);
        }
      }
    }
  }

  // Quantity
  const quantityMatch = text.match(/x\s*(\d+)(?!\d*\s*[a-zA-Z])/i);
  if (quantityMatch) {
    const quantity = parseInt(quantityMatch[1], 10);
    if (!isNaN(quantity) && quantity > 0) {
      result.quantity = quantity;
    }
  }

  // Notes
  const notesMatch = text.match(/\((.*?)\)/);
  if (notesMatch) {
    result.notes = notesMatch[1].trim();
  }

  return result;
}

async function analyzeWithAI(text: string, apiKey: string): Promise<AnalyzedContent | null> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `Extract product information from the text following these rules:
1. Product Name: Text before '#'
2. Product Code: Full code after '#'
3. Vendor UID: 1-4 letters at start of product code
4. Purchase Date: Convert mmDDyy or mDDyy from code to YYYY-MM-DD
5. Quantity: Number after 'x' (ignore if part of measurement)
6. Notes: Text in parentheses`
        },
        { role: 'user', content: text }
      ],
      temperature: 0.3,
      max_tokens: 500
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  try {
    return JSON.parse(data.choices[0].message.content);
  } catch (error) {
    console.error('Error parsing AI response:', error);
    return null;
  }
}

function isValidAnalysis(content: AnalyzedContent): boolean {
  return !!(
    content.product_name &&
    content.product_code &&
    content.vendor_uid &&
    (!content.purchase_date || isValidDate(content.purchase_date)) &&
    (!content.quantity || (content.quantity > 0 && content.quantity < 10000))
  );
}

function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime()) && date <= new Date();
}