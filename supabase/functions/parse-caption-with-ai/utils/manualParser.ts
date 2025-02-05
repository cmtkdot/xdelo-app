import { ParsedContent } from "../../_shared/types";
import { parseQuantity } from "./quantityParser";

interface ParseResult {
  value: string | number;
  confidence: number;
  isValid: boolean;
}

function calculateConfidence(result: ParsedContent, fallbacks: string[]): number {
  let confidence = 1.0;

  // Product Name (most important)
  if (!result.product_name) {
    confidence -= 0.3;
  } else if (result.product_name.length > 3 && result.product_name.length < 100) {
    confidence += 0.1;
  }

  // Product Code and Vendor
  if (!result.product_code) confidence -= 0.15;
  if (!result.vendor_uid) confidence -= 0.15;
  
  // Quantity
  if (!result.quantity) confidence -= 0.15;
  
  // Date
  if (!result.purchase_date) confidence -= 0.1;
  
  // Notes handling
  const hasStructuredNotes = result.notes && (
    result.notes.includes('-') || 
    result.notes.includes('•') || 
    result.notes.includes('\n')
  );
  if (hasStructuredNotes) {
    confidence += 0.1; // Bonus for well-structured notes
  }

  // Fallbacks penalty
  confidence -= fallbacks.length * 0.05;

  return Math.max(0.6, Math.min(1, confidence));
}

function calculateProductNameConfidence(productName: string | undefined, caption: string): ParseResult {
  if (!productName) {
    return { value: '', confidence: 0.3, isValid: false };
  }

  let confidence = 0.7; // Start with base confidence

  // Check if it's a reasonable length for a product name
  if (productName.length > 3 && productName.length < 100) {
    confidence += 0.2;
  }

  // Check for list indicators
  const mainProduct = productName.split(/[-•]/)[0].trim();
  
  return {
    value: mainProduct,
    confidence: confidence,
    isValid: true
  };
}

function calculateQuantityConfidence(quantity: number | undefined, caption: string): ParseResult {
  if (!quantity) {
    return { value: 0, confidence: 0.7, isValid: false };
  }

  let confidence = 0.8;
  
  // Check for quantity indicators
  const hasQuantityIndicator = /\b(?:x|qty|quantity|pcs|pieces)\s*\d+\b/i.test(caption);
  if (hasQuantityIndicator) {
    confidence += 0.2;
  }

  return {
    value: quantity,
    confidence: confidence,
    isValid: true
  };
}

function extractNotes(caption: string): string {
  const sections = caption.split(/[-•]/).slice(1);
  if (sections.length > 0) {
    return sections.map(s => s.trim()).join('\n');
  }
  return '';
}

export async function manualParse(caption: string): Promise<ParsedContent> {
  console.log("Starting manual parsing for:", caption);
  
  // Clean the caption
  const cleanCaption = caption.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
  
  // Extract product name (before any list indicators)
  const productNameResult = calculateProductNameConfidence(cleanCaption, caption);
  
  // Extract quantity
  const quantityResult = calculateQuantityConfidence(
    parseQuantity(cleanCaption),
    cleanCaption
  );

  const result: ParsedContent = {
    product_name: productNameResult.value as string,
    quantity: quantityResult.isValid ? quantityResult.value as number : undefined,
    notes: extractNotes(cleanCaption),
    parsing_metadata: {
      method: 'manual',
      confidence: calculateConfidence(result, []),
      timestamp: new Date().toISOString()
    }
  };

  return result;
}