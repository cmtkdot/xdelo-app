import { AnalyzedContent } from "../types.ts";

export function parseManually(text: string): AnalyzedContent {
  console.log("Manual parsing attempt for:", text);
  const result: AnalyzedContent = {};

  // Product code (everything after #)
  const codeMatch = text.match(/#([A-Za-z0-9]+)/);
  if (codeMatch) {
    result.product_code = codeMatch[1];
    
    // Vendor (letters at start of product code)
    const vendorMatch = result.product_code.match(/^([A-Za-z]+)/);
    if (vendorMatch) {
      result.vendor_uid = vendorMatch[1];
    }
  }

  // Quantity (x followed by number)
  const quantityMatch = text.match(/x\s*(\d+)/i);
  if (quantityMatch) {
    result.quantity = parseInt(quantityMatch[1]);
  }

  // Notes (text in parentheses)
  const notesMatch = text.match(/\((.*?)\)/);
  if (notesMatch) {
    result.notes = notesMatch[1].trim();
  }

  // Product name (everything before #)
  if (text.includes('#')) {
    const productNameMatch = text.split('#')[0].trim();
    if (productNameMatch) {
      result.product_name = productNameMatch;
    }
  } else {
    result.product_name = text.trim();
  }

  console.log("Manual parsing result:", result);
  return result;
}