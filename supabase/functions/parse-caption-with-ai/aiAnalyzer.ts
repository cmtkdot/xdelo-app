
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { ParsedContent } from './types.ts';

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// AI analysis function with improved error handling and fallbacks
export const analyzeWithAI = async (caption: string, manualParsing: ParsedContent) => {
  try {
    console.log('Sending caption to AI analyzer');
    
    // Call the AI analysis Edge Function
    const { data, error } = await supabase.functions.invoke('analyze-with-ai', {
      body: { caption, messageId: 'temp' }
    });
    
    if (error) {
      console.error('Error calling AI analysis function:', error);
      return { success: false, error: error.message, result: null };
    }
    
    if (!data || !data.data) {
      console.error('AI analysis returned no data');
      return { success: false, error: 'No data returned from AI', result: null };
    }
    
    // Extract the AI results
    const aiText = data.data;
    console.log('AI analysis text result:', aiText);
    
    // Basic AI result extraction from text
    const result: Partial<ParsedContent> = {};
    
    // Try to extract product name if clear
    const productNameMatch = aiText.match(/Product name:?\s*([^\n#]+)/i);
    if (productNameMatch) {
      result.product_name = productNameMatch[1].trim();
    }
    
    // Try to extract product code
    const productCodeMatch = aiText.match(/Product code:?\s*([A-Za-z0-9-]+)/i);
    if (productCodeMatch) {
      result.product_code = productCodeMatch[1].trim();
    }
    
    // Try to extract vendor UID
    const vendorMatch = aiText.match(/Vendor(?:\s+ID|UID)?:?\s*([A-Za-z0-9]+)/i);
    if (vendorMatch) {
      result.vendor_uid = vendorMatch[1].trim().toUpperCase();
    } else if (result.product_code) {
      // Extract vendor from product code as fallback
      const vendorFromCode = result.product_code.match(/^([A-Za-z]{1,4})/);
      if (vendorFromCode) {
        result.vendor_uid = vendorFromCode[1].toUpperCase();
      }
    }
    
    // Try to extract purchase date
    const dateMatch = aiText.match(/Purchase date:?\s*(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\/\d{1,2}\/\d{2,4})/i);
    if (dateMatch) {
      let dateStr = dateMatch[1];
      // Normalize date format to YYYY-MM-DD
      if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          // Assume MM/DD/YY or MM/DD/YYYY format
          let year = parts[2];
          if (year.length === 2) {
            year = '20' + year; // Assume 21st century for 2-digit years
          }
          dateStr = `${year}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
        }
      }
      result.purchase_date = dateStr;
    }
    
    // Try to extract quantity
    const quantityMatch = aiText.match(/Quantity:?\s*(\d+)/i);
    if (quantityMatch) {
      result.quantity = parseInt(quantityMatch[1], 10);
    }
    
    // Try to extract notes
    const notesMatch = aiText.match(/Notes:?\s*([^\n]+)/i);
    if (notesMatch) {
      result.notes = notesMatch[1].trim();
    }
    
    // Fallback to manual parsing for any missing fields
    const enhancedResult: ParsedContent = {
      product_name: result.product_name || manualParsing.product_name,
      product_code: result.product_code || manualParsing.product_code,
      vendor_uid: result.vendor_uid || manualParsing.vendor_uid,
      purchase_date: result.purchase_date || manualParsing.purchase_date,
      quantity: result.quantity ?? manualParsing.quantity,
      notes: result.notes || manualParsing.notes,
      caption: manualParsing.caption,
      parsing_metadata: {
        method: 'ai',
        timestamp: new Date().toISOString(),
        confidence: 0.8, // Arbitrary confidence level for now
        ai_response: aiText
      }
    };
    
    console.log('Enhanced AI result:', enhancedResult);
    return { success: true, result: enhancedResult };
  } catch (error) {
    console.error('Error in AI analysis:', error);
    return { success: false, error: error.message, result: null };
  }
}
