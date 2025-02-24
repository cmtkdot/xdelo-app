import { ParsedResult as BaseParseResult, QuantityParseResult } from '../types';

// Extend the base ParsedResult type to include new fields
interface ParsedResult extends BaseParseResult {
  product_sku?: string;
  purchase_order_uid?: string;
}

function calculateConfidence(result: ParsedResult, fallbacks: string[], caption: string): number {
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
  
  // Product Name Quality (increased importance)
  if (result.product_name) {
    const isReasonableLength = result.product_name.length <= 23;
    if (!isReasonableLength) {
      score -= 0.5; // Significant penalty for long product names
      fallbacks.push('product_name_too_long');
    }
  }
  
  // Quantity check
  if (result.quantity && result.quantity > 0) {
    const isReasonable = result.quantity > 0 && result.quantity < 10000;
    score += isReasonable ? 0.2 : -0.1;
  } else {
    score -= 0.3;
  }
  
  // Fallbacks Impact (20% weight)
  const criticalFallbacks = ['no_product_code', 'no_quantity', 'product_name_too_long'];
  const hasCriticalFallbacks = fallbacks.some(f => criticalFallbacks.includes(f));
  
  if (hasCriticalFallbacks) {
    score -= 0.3;
  } else {
    score -= fallbacks.length * 0.1;
  }
  
  // Normalize score
  return Math.max(0.1, Math.min(1, score));
}

function parseQuantity(caption: string): QuantityParseResult | null {
  // Look for patterns like "x2", "x 2", "qty: 2", "quantity: 2"
  const patterns = [
    /x\s*(\d+)/i,                    // x2 or x 2
    /qty:\s*(\d+)/i,                 // qty: 2
    /quantity:\s*(\d+)/i,            // quantity: 2
    /(\d+)\s*(?:pcs|pieces)/i,       // 2 pcs or 2 pieces
    /(\d+)\s*(?:units?)/i,           // 2 unit or 2 units
    /(\d+)\s*(?=\s|$)/               // standalone number
  ];

  for (const pattern of patterns) {
    const match = caption.match(pattern);
    if (match) {
      const value = parseInt(match[1], 10);
      if (value > 0 && value < 10000) { // Reasonable quantity range
        return {
          value,
          confidence: 0.9 // High confidence for explicit patterns
        };
      }
    }
  }

  return null;
}

/**
 * Attempts to parse structured data from caption using regex patterns.
 * Returns null if product name is too long or critical fields are missing.
 */
export async function parseManually(caption: string): Promise<ParsedResult | null> {
  console.log("Starting manual parsing for:", caption);
  const result: ParsedResult = {};
  const fallbacks_used: string[] = [];

  // Extract product name (text before line break, dash, # or x)
  const xIndex = caption.toLowerCase().indexOf('x');
  const hashIndex = caption.indexOf('#');
  const lineBreakIndex = caption.indexOf('\n');
  const dashIndex = caption.indexOf('-');
  let endIndex = caption.length;
  
  if (xIndex > 0) endIndex = Math.min(endIndex, xIndex);
  if (hashIndex > 0) endIndex = Math.min(endIndex, hashIndex);
  if (lineBreakIndex > 0) endIndex = Math.min(endIndex, lineBreakIndex);
  if (dashIndex > 0) endIndex = Math.min(endIndex, dashIndex);
  
  const productNameMatch = caption.substring(0, endIndex).trim();
  if (productNameMatch) {
    result.product_name = productNameMatch;
    // Check product name length immediately
    if (productNameMatch.length > 23) {
      console.log("Product name too long, triggering AI analysis:", productNameMatch.length);
      return null;
    }
  } else {
    result.product_name = caption.trim();
    fallbacks_used.push('no_product_name_marker');
    // If we're using full caption as product name, trigger AI
    return null;
  }

  // Extract product code and vendor UID
  const codeMatch = caption.match(/#([A-Za-z0-9-]+)/);
  if (codeMatch) {
    result.product_code = codeMatch[1];
    
    const vendorMatch = result.product_code.match(/^([A-Za-z]{1,4})/);
    if (vendorMatch) {
      result.vendor_uid = vendorMatch[1].toUpperCase();
      
      // Extract and parse date
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
            
            // Generate purchase_order_uid
            if (result.vendor_uid && result.purchase_date) {
              const datePart = result.purchase_date.replace(/-/g, '').substring(2); // Get YYMMDD format
              result.purchase_order_uid = `${result.vendor_uid}#${datePart}`;
            }
          } else {
            fallbacks_used.push('invalid_date');
          }
        } catch (error) {
          console.error("Date parsing error:", error);
          fallbacks_used.push('date_parse_error');
        }
      }
    }
  } else {
    fallbacks_used.push('no_product_code');
  }

  // Generate product_sku if we have both product_name and product_code
  if (result.product_name && result.product_code) {
    result.product_sku = `${result.product_name} #${result.product_code}`;
  }

  // Parse quantity using the enhanced quantityParser
  const quantityResult = parseQuantity(caption);
  if (quantityResult) {
    result.quantity = quantityResult.value;
  } else {
    fallbacks_used.push('no_quantity');
  }

  // Extract notes (text in parentheses or remaining text)
  const notesMatch = caption.match(/\((.*?)\)/);
  if (notesMatch) {
    result.notes = notesMatch[1].trim();
  } else {
    // If no parentheses, look for any remaining text after the product code and quantity
    const remainingText = caption
      .replace(/#[A-Za-z0-9-]+/, '') // Remove product code
      .replace(/x\s*\d+/, '')        // Remove quantity
      .replace(productNameMatch, '')  // Remove product name
      .trim();
    
    if (remainingText) {
      result.notes = remainingText;
    }
  }

  const confidence = calculateConfidence(result, fallbacks_used, caption);
  
  // Modified return condition to include product name length check
  const hasCriticalIssues = 
    fallbacks_used.includes('product_name_too_long') || 
    fallbacks_used.includes('no_product_code') ||
    confidence < 0.4;

  if (hasCriticalIssues) {
    console.log("Manual parsing failed due to:", {
      fallbacks: fallbacks_used,
      confidence,
      productNameLength: result.product_name?.length
    });
    return null;
  }

  result.parsing_metadata = {
    method: 'manual',
    confidence,
    fallbacks_used: fallbacks_used.length ? fallbacks_used : undefined,
    timestamp: new Date().toISOString(),
    needs_ai_analysis: false // We're now handling this through the return null
  };

  return result;
}
