import { SupabaseClient } from "@supabase/supabase-js";
import { AnalyzedContent } from "../types";
import { logParserEvent } from "./webhookLogs";

export interface RequestData {
  messageId: string;
  caption: string;
  correlationId: string;
  media_group_id?: string;
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Request validation
export const validateRequest = (data: unknown): RequestData => {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid request data');
  }

  const request = data as Partial<RequestData>;
  
  if (!request.messageId || !request.caption || !request.correlationId) {
    throw new Error('Missing required fields: messageId, caption, and correlationId');
  }

  return {
    messageId: request.messageId,
    caption: request.caption,
    correlationId: request.correlationId,
    media_group_id: request.media_group_id
  };
};

// OpenAI API call
export const callOpenAI = async (caption: string, openAIApiKey: string) => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `Extract product information from captions using this format:
            - product_name (before #)
            - product_code (after #)
            - vendor_uid (letters at start of code)
            - quantity (number after x)
            - purchase_date (if found, in YYYY-MM-DD)
            - notes (additional info)`
        },
        { role: 'user', content: caption }
      ]
    })
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`OpenAI API error: ${response.status} - ${error.message || response.statusText}`);
  }
  
  const aiResult = await response.json();
  if (!aiResult?.choices?.[0]?.message?.content) {
    throw new Error('Invalid AI response format');
  }
  
  try {
    return JSON.parse(aiResult.choices[0].message.content);
  } catch (e) {
    throw new Error('Failed to parse AI response as JSON');
  }
};

// Retry mechanism
export const analyzeWithAI = async (caption: string, openAIApiKey: string, retries = 2) => {
  for (let i = 0; i <= retries; i++) {
    try {
      return await callOpenAI(caption, openAIApiKey);
    } catch (error) {
      if (i === retries) throw error;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
};

// Result validation
export const validateAnalyzedContent = (content: AnalyzedContent): boolean => {
  if (!content.product_name || !content.product_code) {
    return false;
  }
  
  if (!/^[A-Z]{1,4}\d{5,6}$/.test(content.product_code)) {
    return false;
  }
  
  if (content.quantity && (content.quantity < 1 || content.quantity > 10000)) {
    return false;
  }
  
  return true;
};

// Error handling
export const handleError = async (supabase: SupabaseClient, error: Error, messageId: string) => {
  const errorData = {
    processing_state: 'error' as const,
    error_message: error.message,
    last_error_at: new Date().toISOString()
  };
  
  await Promise.all([
    supabase.from('messages').update(errorData).eq('id', messageId),
    logParserEvent(supabase, {
      event_type: 'analysis_error',
      message_id: messageId,
      error_message: error.message,
      metadata: {
        stack: error.stack
      }
    })
  ]);
}; 