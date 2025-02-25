import { AnalyzedContent } from "../../_shared/types.ts";
import { getLogger } from "./logger.ts";
import { parseQuantity } from "./quantityParser.ts";

function calculateConfidence(
  result: AnalyzedContent, 
  fallbacks: string[], 
  caption: string
): number {
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

async function manualParse(caption: string): Promise<AnalyzedContent> {
  const logger = getLogger(crypto.randomUUID());
  logger.info("Starting manual parsing", { captionLength: caption.length });
  
  const result: AnalyzedContent = {};
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
  } else {
    result.product_name = caption.trim();
    fallbacks_used.push('no_product_name_marker');
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
          } else {
            fallbacks_used.push('invalid_date');
          }
        } catch (error) {
          logger.error("Date parsing error", { error });
          fallbacks_used.push('date_parse_error');
        }
      }
    }
  } else {
    fallbacks_used.push('no_product_code');
  }

  // Parse quantity
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
  
  // Calculate if we have critical fallbacks
  const criticalFallbacks = ['no_product_code', 'no_quantity'];
  const hasCriticalFallbacks = fallbacks_used.some(f => criticalFallbacks.includes(f));
  // Only check product_name length for AI analysis, no confidence score needed
  const needsAiAnalysis = !!(result.product_name && result.product_name.length > 23);

  result.parsing_metadata = {
    method: 'manual',
    confidence,
    fallbacks_used: fallbacks_used.length ? fallbacks_used : undefined,
    timestamp: new Date().toISOString(),
    needs_ai_analysis: needsAiAnalysis
  };

  logger.info("Manual parsing result", {
    confidence,
    needs_ai_analysis: needsAiAnalysis,
    fallbacks: fallbacks_used
  });

  return result;
}

export async function analyzeCaption(
  caption: string, 
  correlationId: string
): Promise<AnalyzedContent> {
  const logger = getLogger(correlationId);
  
  if (!caption || caption.trim().length === 0) {
    logger.info("Empty caption, returning minimal result");
    return {
      parsing_metadata: {
        method: 'manual',
        confidence: 0.1,
        timestamp: new Date().toISOString(),
        needs_ai_analysis: false
      }
    };
  }
  
  try {
    logger.info("Starting caption analysis", { captionLength: caption.length });
    
    // First try manual parsing
    const manualResult = await manualParse(caption);
    
    // Check if AI analysis is needed
    if (manualResult.parsing_metadata?.needs_ai_analysis) {
      logger.info("Manual parsing needs AI enhancement", { 
        confidence: manualResult.parsing_metadata.confidence,
        fallbacks: manualResult.parsing_metadata.fallbacks_used
      });
      
      // In a real implementation, we would call an AI service here
      // For now, we'll just return the manual result with a note
      manualResult.notes = (manualResult.notes || '') + 
        ' [AI analysis would be performed here in production]';
    }
    
    return manualResult;
    
  } catch (error) {
    logger.error("Error analyzing caption", { error });
    
    // Return basic info even if analysis fails
    return {
      product_name: caption.split('\n')[0]?.trim() || 'Untitled Product',
      notes: 'Error during analysis',
      parsing_metadata: {
        method: 'manual',
        confidence: 0.1,
        timestamp: new Date().toISOString(),
        fallbacks_used: ['error_fallback']
      }
    };
  }
}
