import { ParsedContent } from "../types.ts";
import { parseQuantity } from "./quantityParser.ts";

function calculateConfidence(result: ParsedContent, fallbacks: string[], caption: string): number {
  let score = 1.0;
  
  // Structure Analysis (40% weight)
  const hasExpectedFormat = caption.match(/^[^#\n]+#[A-Z]{1,4}\d{5,6}/);
  const hasQuantityPattern = /\d+\s*(?:x|pcs|pieces|kg|g|meters|m|boxes)/i.test(caption);
  const hasLineBreaks = caption.includes('\n');
  const hasParentheses = /\(.*\)/.test(caption);
  
  if (hasExpectedFormat) score += 0.2;
  if (!hasQuantityPattern) score -= 0.3;
  if (hasLineBreaks && hasParentheses) score += 0.1;
  
  // Data Quality (40% weight)
  if (result.product_code) {
    const isValidFormat = /^[A-Z]{1,4}\d{5,6}$/.test(result.product_code);
    score += isValidFormat ? 0.2 : -0.2;
    
    // Check vendor and date parts
    if (result.vendor_uid && result.purchase_date) {
      score += 0.2;
    }
  } else {
    score -= 0.4;
  }
  
  if (result.quantity && result.quantity > 0) {
    const isReasonable = result.quantity > 0 && result.quantity < 10000;
    score += isReasonable ? 0.2 : -0.1;
  } else {
    score -= 0.3;
  }
  
  // Product Name Quality
  if (result.product_name && result.product_name !== caption) {
    const isReasonableLength = result.product_name.length > 3 && result.product_name.length < 100;
    score += isReasonableLength ? 0.1 : -0.1;
  }
  
  // Fallbacks Impact (20% weight)
  const criticalFallbacks = ['no_product_code', 'no_quantity'];
  const hasCriticalFallbacks = fallbacks.some(f => criticalFallbacks.includes(f));
  
  if (hasCriticalFallbacks) {
    score -= 0.3;
  } else {
    score -= fallbacks.length * 0.1;
  }
  
  // Normalize score
  return Math.max(0.1, Math.min(1, score));
}

export async function manualParse(caption: string): Promise<ParsedContent> {
  console.log("Starting manual parsing for:", caption);
  
  // Default to caption if empty or no specific product name found
  if (!caption?.trim()) {
    return {
      product_name: '',
      parsing_metadata: {
        method: 'manual',
        confidence: 0.1,
        timestamp: new Date().toISOString(),
        needs_ai_analysis: true
      }
    };
  }

  // Try to extract product name from first line
  const lines = caption.split('\n');
  const firstLine = lines[0]?.trim();
  const productName = firstLine?.split('#')[0]?.trim() || caption.trim();

  // Initialize result with required product name and metadata
  let confidence = 0.1;
  const metadata: ParsedContent['parsing_metadata'] = {
    method: 'manual',
    confidence,
    timestamp: new Date().toISOString(),
    needs_ai_analysis: true,
    manual_confidence: confidence
  };

  const result: ParsedContent = {
    product_name: productName,
    parsing_metadata: metadata
  };

  try {
    // Try to extract product code (format: #VENDOR123456)
    const codeMatch = caption.match(/#([A-Za-z]{1,4}\d{5,6})/);
    if (codeMatch) {
      result.product_code = codeMatch[1];
      result.vendor_uid = codeMatch[1].match(/[A-Za-z]+/)?.[0] || '';
      confidence = 0.5;
      metadata.confidence = confidence;
      metadata.manual_confidence = confidence;
      metadata.needs_ai_analysis = false;
    }

    // Try to extract quantity (format: x123 or ×123)
    const qtyMatch = caption.match(/[x×](\d+)/i);
    if (qtyMatch) {
      result.quantity = parseInt(qtyMatch[1], 10);
      confidence = Math.min(1, confidence + 0.2);
      metadata.confidence = confidence;
      metadata.manual_confidence = confidence;
    }

    // Try to extract date (format: mmddyy or mddyy)
    const dateMatch = caption.match(/(\d{5,6})/);
    if (dateMatch && result.product_code) {
      const dateStr = dateMatch[1].padStart(6, '0');
      const month = parseInt(dateStr.slice(0, 2), 10);
      const day = parseInt(dateStr.slice(2, 4), 10);
      const year = parseInt(dateStr.slice(4), 10);
      
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const fullYear = 2000 + year;
        result.purchase_date = `${fullYear}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        confidence = Math.min(1, confidence + 0.2);
        metadata.confidence = confidence;
        metadata.manual_confidence = confidence;
      }
    }

    // Extract notes (anything in parentheses)
    const notesMatch = caption.match(/\((.*?)\)/);
    if (notesMatch) {
      result.notes = notesMatch[1].trim();
      confidence = Math.min(1, confidence + 0.1);
      metadata.confidence = confidence;
      metadata.manual_confidence = confidence;
    }

    // Set final AI need based on confidence
    metadata.needs_ai_analysis = confidence < 0.5;

    console.log("Manual parsing result:", result);
    return result;

  } catch (error) {
    console.error("Error in manual parsing:", error);
    return {
      product_name: productName,
      parsing_metadata: {
        method: 'manual',
        confidence: 0.1,
        timestamp: new Date().toISOString(),
        needs_ai_analysis: true,
        fallbacks_used: ['error_recovery']
      }
    };
  }
}