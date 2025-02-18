
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ExtractedData {
  transcription: string;
  purchase_date?: string;
  product_name?: string;
  account_uid?: string;
  quantity?: number;
  transaction_type?: 'invoice' | 'purchase_order';
  confidence: number;
  processed_at: string;
}

// Helper function to extract date from text
const extractDate = (text: string): string | undefined => {
  const dateRegex = /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})|(\w+ \d{1,2},? \d{4})/i;
  const match = text.match(dateRegex);
  if (match) {
    const date = new Date(match[0]);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }
  return undefined;
};

// Helper function to extract quantity from text
const extractQuantity = (text: string): number | undefined => {
  const quantityRegex = /(\d+)\s*(pc|pcs|pieces|units|items?)/i;
  const match = text.match(quantityRegex);
  return match ? parseInt(match[1]) : undefined;
};

// Helper function to determine transaction type
const determineTransactionType = (text: string): 'invoice' | 'purchase_order' | undefined => {
  const invoiceKeywords = /(invoice|sale|sold|customer|client)/i;
  const purchaseKeywords = /(purchase|order|supplier|vendor|buying)/i;
  
  if (invoiceKeywords.test(text)) return 'invoice';
  if (purchaseKeywords.test(text)) return 'purchase_order';
  return undefined;
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get entry ID from request
    const { entryId } = await req.json()

    if (!entryId) {
      throw new Error('Entry ID is required')
    }

    // Get the entry details
    const { data: entry, error: fetchError } = await supabase
      .from('raw_product_entries')
      .select('*')
      .eq('id', entryId)
      .single()

    if (fetchError) {
      throw fetchError
    }

    if (!entry.audio_url) {
      throw new Error('No audio URL found for entry')
    }

    console.log(`Processing audio entry: ${entryId}`)
    console.log(`Audio URL: ${entry.audio_url}`)

    // TODO: Integrate with a speech-to-text service
    // For now, we'll use a mock transcription
    const mockTranscription = "On January 15, 2024, ordered 50 pieces of wooden chairs from vendor ABC123. This is a purchase order.";

    // Extract information from transcription
    const extractedData: ExtractedData = {
      transcription: mockTranscription,
      purchase_date: extractDate(mockTranscription),
      quantity: extractQuantity(mockTranscription),
      transaction_type: determineTransactionType(mockTranscription),
      confidence: 0.95,
      processed_at: new Date().toISOString()
    };

    // Basic product name extraction (this would need to be more sophisticated in production)
    const productMatch = mockTranscription.match(/of\s+(.+?)\s+from/i);
    if (productMatch) {
      extractedData.product_name = productMatch[1];
    }

    // Basic account UID extraction (this would need to be more sophisticated in production)
    const accountMatch = mockTranscription.match(/(?:from|vendor|supplier)\s+([A-Z0-9]+)/i);
    if (accountMatch) {
      extractedData.account_uid = accountMatch[1];
    }

    // Update the entry with extracted data
    const { error: updateError } = await supabase
      .from('raw_product_entries')
      .update({
        processing_status: 'processed',
        processed_at: new Date().toISOString(),
        extracted_data: extractedData,
        needs_manual_review: true // Set to true so human can verify the extracted data
      })
      .eq('id', entryId);

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify({ 
        message: 'Audio processing completed',
        entryId,
        extractedData 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error processing audio:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
