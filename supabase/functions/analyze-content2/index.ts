import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import OpenAI from "https://esm.sh/openai@4.28.0";

// Deno types
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

interface AnalyzedContent {
  product_name?: string;
  product_code?: string;
  quantity?: number;
  vendor_uid?: string;
  purchase_date?: string;
  notes?: string;
}

interface AnalysisResult {
  caption: string;
  extracted_data: AnalyzedContent | null;
  confidence: number;
  timestamp: string;
  model_version: string;
  error?: string;
}

type MessageProcessingState =
  | "initialized"
  | "caption_ready"
  | "analyzing"
  | "analysis_synced"
  | "analysis_failed"
  | "completed";

interface MessageUpdate {
  analyzed_content?: AnalysisResult;
  processing_state?: MessageProcessingState;
  processing_started_at?: string;
  processing_completed_at?: string;
  error_message?: string | null;
  group_caption_synced?: boolean;
}

interface BaseProcessingLog {
  event: string;
  message_id: string;
  media_group_id?: string;
  duration_ms?: number;
  state?: MessageProcessingState;
  error?: string;
  metadata?: Record<string, any>;
}

interface ProcessingLog extends BaseProcessingLog {
  timestamp: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function parseDateFromCode(dateStr: string): string | null {
  try {
    if (!dateStr || dateStr.length < 5) return null;

    // Handle both 5 and 6 digit formats
    let month: string, day: string, year: string;

    if (dateStr.length === 5) {
      // Format: #CHAD12345 (single digit month)
      month = `0${dateStr[0]}`;
      day = dateStr.substring(1, 3);
      year = dateStr.substring(3, 5);
    } else {
      // Format: #CHAD123456 (two digit month)
      month = dateStr.substring(0, 2);
      day = dateStr.substring(2, 4);
      year = dateStr.substring(4, 6);
    }

    // Validate month and day
    const monthNum = parseInt(month);
    const dayNum = parseInt(day);

    if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) {
      return null;
    }

    // Convert to full year format
    const fullYear = `20${year}`;
    const date = new Date(`${fullYear}-${month}-${day}`);

    // Check if date is valid and not in the future
    if (isNaN(date.getTime()) || date > new Date()) {
      return null;
    }

    return `${fullYear}-${month}-${day}`;
  } catch (error) {
    console.error("Error parsing date:", error);
    return null;
  }
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
    }

    Input: "Purple Haze #CHAD12345 x3"
    Output: {
      "product_name": "Purple Haze",
      "product_code": "#CHAD12345",
      "quantity": 3,
      "vendor_uid": "CHAD",
      "purchase_date": "2023-01-23",
      "notes": null
    }`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
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

      // Double-check the date parsing even from AI response
      if (extractedData.product_code) {
        const codeMatch = extractedData.product_code.match(/#[A-Z]+(\d+)/);
        if (codeMatch) {
          const dateStr = codeMatch[1];
          const parsedDate = parseDateFromCode(dateStr);
          if (parsedDate) {
            extractedData.purchase_date = parsedDate;
          } else {
            console.log("AI provided date was invalid, setting to null");
            extractedData.purchase_date = null;
          }
        }
      }
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

function parseManually(text: string): any {
  console.log("Falling back to manual parsing for:", text);

  const result: any = {
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

    // Parse date from code using our enhanced date parser
    const dateStr = codeMatch[2];
    result.purchase_date = parseDateFromCode(dateStr);
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

function logProcessingEvent(log: BaseProcessingLog) {
  const timestamp = new Date().toISOString();
  console.log(
    JSON.stringify({
      ...log,
      timestamp,
      environment: Deno.env.get("ENVIRONMENT") || "development",
    })
  );
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

    logProcessingEvent({
      event: "ANALYSIS_STARTED",
      message_id,
      state: "initialized",
      metadata: {
        correlation_id: correlationId,
      },
    });

    // Fetch the target message and check if it's part of a group
    const { data: message, error: messageError } = await supabase
      .from("messages")
      .select("*, media_group_messages:messages!media_group_id(*)")
      .eq("id", message_id)
      .single();

    if (messageError) {
      logProcessingEvent({
        event: "MESSAGE_FETCH_ERROR",
        message_id,
        error: messageError.message,
        metadata: {
          correlation_id: correlationId,
          error_details: messageError,
        },
      });
      throw messageError;
    }

    if (!message) {
      const error = "Message not found";
      logProcessingEvent({
        event: "MESSAGE_NOT_FOUND",
        message_id,
        error,
        metadata: { correlation_id: correlationId },
      });
      throw new Error(error);
    }

    // Check if message is already processed or being processed
    if (
      message.processing_state === "completed" ||
      message.processing_state === "analysis_synced"
    ) {
      logProcessingEvent({
        event: "ALREADY_PROCESSED",
        message_id,
        media_group_id: message.media_group_id,
        state: message.processing_state as MessageProcessingState,
        metadata: {
          correlation_id: correlationId,
          analyzed_content: message.analyzed_content,
          skip_reason: "already_processed",
        },
      });
      return new Response(
        JSON.stringify({
          success: true,
          already_processed: true,
          analyzed_content: message.analyzed_content,
          correlation_id: correlationId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if this is part of a media group and if another message in the group is already processed
    if (message.media_group_id && message.media_group_messages) {
      const processedGroupMessage = message.media_group_messages.find(
        (m: any) =>
          m.analyzed_content &&
          (m.processing_state === "completed" ||
            m.processing_state === "analysis_synced")
      );

      if (processedGroupMessage) {
        // Use the existing analysis from the group
        const { error: syncError } = await supabase.rpc(
          "process_media_group_analysis",
          {
            p_message_id: message_id,
            p_media_group_id: message.media_group_id,
            p_analyzed_content: processedGroupMessage.analyzed_content,
            p_processing_completed_at: new Date().toISOString(),
            p_correlation_id: correlationId,
          }
        );

        if (syncError) {
          logProcessingEvent({
            event: "GROUP_SYNC_REUSE_ERROR",
            message_id,
            media_group_id: message.media_group_id,
            error: syncError.message,
            metadata: {
              correlation_id: correlationId,
              source_message_id: processedGroupMessage.id,
            },
          });
          throw syncError;
        }

        logProcessingEvent({
          event: "REUSED_GROUP_ANALYSIS",
          message_id,
          media_group_id: message.media_group_id,
          state: "analysis_synced",
          metadata: {
            correlation_id: correlationId,
            source_message_id: processedGroupMessage.id,
          },
        });

        return new Response(
          JSON.stringify({
            success: true,
            reused_analysis: true,
            analyzed_content: processedGroupMessage.analyzed_content,
            correlation_id: correlationId,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // If we get here, we need to process this message
    logProcessingEvent({
      event: "MESSAGE_FETCHED",
      message_id,
      media_group_id: message.media_group_id,
      duration_ms: Date.now() - startTime,
      state: message.processing_state as MessageProcessingState,
      metadata: {
        correlation_id: correlationId,
        has_caption: !!message.caption,
        group_size: message.media_group_messages?.length,
        requires_processing: true,
      },
    });

    // Update state to analyzing
    const { error: stateError } = await supabase
      .from("messages")
      .update({
        processing_state: "analyzing",
        processing_started_at: new Date().toISOString(),
      })
      .eq("id", message_id);

    if (stateError) {
      logProcessingEvent({
        event: "STATE_UPDATE_ERROR",
        message_id,
        media_group_id: message.media_group_id,
        error: stateError.message,
        metadata: {
          correlation_id: correlationId,
          target_state: "analyzing",
        },
      });
      throw stateError;
    }

    // Analyze the caption
    const analysisStartTime = Date.now();
    const analyzedContent = await analyzeCaption(message.caption);

    logProcessingEvent({
      event: "ANALYSIS_COMPLETED",
      message_id,
      media_group_id: message.media_group_id,
      duration_ms: Date.now() - analysisStartTime,
      metadata: {
        correlation_id: correlationId,
        confidence: analyzedContent.confidence,
      },
    });

    // Begin transaction for group updates
    const { error: transactionError } = await supabase.rpc(
      "process_media_group_analysis",
      {
        p_message_id: message_id,
        p_media_group_id: message.media_group_id,
        p_analyzed_content: analyzedContent,
        p_processing_completed_at: new Date().toISOString(),
      }
    );

    if (transactionError) {
      logProcessingEvent({
        event: "GROUP_SYNC_ERROR",
        message_id,
        media_group_id: message.media_group_id,
        error: transactionError.message,
        metadata: {
          correlation_id: correlationId,
          error_details: transactionError,
        },
      });
      throw transactionError;
    }

    const totalDuration = Date.now() - startTime;
    logProcessingEvent({
      event: "PROCESSING_COMPLETED",
      message_id,
      media_group_id: message.media_group_id,
      duration_ms: totalDuration,
      state: "completed",
      metadata: {
        correlation_id: correlationId,
        analysis_duration_ms: Date.now() - analysisStartTime,
        total_duration_ms: totalDuration,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        analyzed_content: analyzedContent,
        processing_time_ms: totalDuration,
        correlation_id: correlationId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorEvent = {
      event: "PROCESSING_FAILED",
      message_id: req.message_id || "unknown",
      error: error.message,
      metadata: {
        correlation_id: correlationId,
        error_stack: error.stack,
        error_details: error,
      },
    };
    logProcessingEvent(errorEvent);

    // Update message state to failed
    try {
      if (error.message !== "Message not found" && req.message_id) {
        const { error: updateError } = await supabase
          .from("messages")
          .update({
            processing_state: "analysis_failed",
            error_message: JSON.stringify(errorEvent),
            processing_completed_at: new Date().toISOString(),
          })
          .eq("id", req.message_id);

        if (updateError) {
          logProcessingEvent({
            event: "ERROR_STATUS_UPDATE_FAILED",
            message_id: req.message_id,
            error: updateError.message,
            metadata: {
              correlation_id: correlationId,
              original_error: error.message,
            },
          });
        }
      }
    } catch (updateError) {
      logProcessingEvent({
        event: "ERROR_HANDLING_FAILED",
        message_id: req.message_id || "unknown",
        error: updateError.message,
        metadata: {
          correlation_id: correlationId,
          original_error: error.message,
        },
      });
    }

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
