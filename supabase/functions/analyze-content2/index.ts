import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import OpenAI from "https://esm.sh/openai@4.28.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface AnalyzedContent {
  product_name?: string;
  product_code?: string;
  quantity?: number;
  vendor_uid?: string;
  purchase_date?: string;
  notes?: string;
}

async function analyzeCaption(caption: string): Promise<any> {
  try {
    console.log("Analyzing caption:", caption);

    const openai = new OpenAI({
      apiKey: Deno.env.get("OPENAI_API_KEY"),
    });

    const systemPrompt = `You are a product data extractor. Extract the following information from the given text:
    1. Product name (exclude any codes or quantities)
    2. Product code (starting with #)
    3. Quantity (number following 'x')
    4. Vendor ID (letters in the product code before any numbers)
    5. Purchase date (numbers in the product code)
       - Format: MMDDYY or MDDYY (5 or 6 digits)
       - Example 1: #CHAD120523 → 2023-12-05 (MMDDYY)
       - Example 2: #CHAD12345 → 2023-01-23 (MDDYY)
       - Return null if date is invalid or in future
    6. Notes (any text in parentheses)

    Example inputs and outputs:
    Input: "Blue Dream #CHAD120523 x2 (sample)"
    Output: {
      "product_name": "Blue Dream",
      "product_code": "#CHAD120523",
      "quantity": 2,
      "vendor_uid": "CHAD",
      "purchase_date": "2023-12-05",
      "notes": "sample"
    }`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: caption },
      ],
      temperature: 0.1,
      max_tokens: 500,
    });

    const response = completion.choices[0].message.content.trim();
    console.log("AI Response:", response);

    let extractedData;
    try {
      extractedData = JSON.parse(response);
    } catch (error) {
      console.error("Error parsing AI response:", error);
      extractedData = parseManually(caption);
    }

    return {
      caption,
      extracted_data: extractedData,
      confidence: 0.9,
      timestamp: new Date().toISOString(),
      model_version: "1.0",
    };
  } catch (error) {
    console.error("Error in caption analysis:", error);
    return {
      caption,
      extracted_data: parseManually(caption),
      confidence: 0.5,
      timestamp: new Date().toISOString(),
      model_version: "1.0",
      error: error.message,
    };
  }
}

function parseManually(text: string): AnalyzedContent {
  console.log("Falling back to manual parsing for:", text);

  const result: AnalyzedContent = {
    product_name: null,
    product_code: null,
    quantity: null,
    vendor_uid: null,
    purchase_date: null,
    notes: null,
  };

  // Extract product code and vendor_uid
  const codeMatch = text.match(/#([A-Z]+)(\d+)/);
  if (codeMatch) {
    result.product_code = codeMatch[0];
    result.vendor_uid = codeMatch[1];

    // Parse date from code
    const dateStr = codeMatch[2];
    if (dateStr.length >= 5) {
      let month: string, day: string, year: string;

      if (dateStr.length === 5) {
        month = `0${dateStr[0]}`;
        day = dateStr.substring(1, 3);
        year = dateStr.substring(3, 5);
      } else {
        month = dateStr.substring(0, 2);
        day = dateStr.substring(2, 4);
        year = dateStr.substring(4, 6);
      }

      const fullYear = `20${year}`;
      const date = new Date(`${fullYear}-${month}-${day}`);

      if (!isNaN(date.getTime()) && date <= new Date()) {
        result.purchase_date = `${fullYear}-${month}-${day}`;
      }
    }
  }

  // Extract quantity
  const quantityMatch = text.match(/x\s*(\d+)/i);
  if (quantityMatch) {
    result.quantity = parseInt(quantityMatch[1]);
  }

  // Extract notes (text in parentheses)
  const notesMatch = text.match(/\((.*?)\)/);
  if (notesMatch) {
    result.notes = notesMatch[1].trim();
  }

  // Extract product name (everything before the product code)
  const productNameMatch = text.split("#")[0];
  if (productNameMatch) {
    result.product_name = productNameMatch.trim();
  }

  return result;
}

serve(async (req) => {
  const startTime = Date.now();
  const correlationId = crypto.randomUUID();

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    const { message_id } = await req.json();
    console.log("Processing message:", message_id);

    // Fetch the message
    const { data: message, error: messageError } = await supabase
      .from("messages")
      .select("*")
      .eq("id", message_id)
      .single();

    if (messageError) {
      throw messageError;
    }

    if (!message) {
      throw new Error("Message not found");
    }

    if (!message.caption) {
      console.log("No caption to analyze for message:", message_id);
      return new Response(
        JSON.stringify({
          success: false,
          error: "No caption to analyze",
          correlation_id: correlationId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Analyze the caption
    console.log("Analyzing caption for message:", message_id);
    const analyzedContent = await analyzeCaption(message.caption);

    // Update the message with analyzed content
    const { error: updateError } = await supabase
      .from("messages")
      .update({
        analyzed_content: analyzedContent,
        processing_state: "analyzing",
        processing_started_at: new Date().toISOString(),
      })
      .eq("id", message_id);

    if (updateError) {
      throw updateError;
    }

    // Process media group if needed
    if (message.media_group_id) {
      console.log("Processing media group:", message.media_group_id);
      const { error: groupError } = await supabase.rpc(
        "process_media_group_analysis",
        {
          p_message_id: message_id,
          p_media_group_id: message.media_group_id,
          p_analyzed_content: analyzedContent,
          p_processing_completed_at: new Date().toISOString(),
        }
      );

      if (groupError) {
        throw groupError;
      }
    } else {
      // Update single message to completed state
      const { error: completeError } = await supabase
        .from("messages")
        .update({
          processing_state: "completed",
          processing_completed_at: new Date().toISOString(),
        })
        .eq("id", message_id);

      if (completeError) {
        throw completeError;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`Analysis completed in ${duration}ms for message:`, message_id);

    return new Response(
      JSON.stringify({
        success: true,
        analyzed_content: analyzedContent,
        processing_time_ms: duration,
        correlation_id: correlationId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing message:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
        correlation_id: correlationId,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});