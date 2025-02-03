import { AnalyzedContent } from "../types.ts";

export function parseManually(text: string): AnalyzedContent {
  console.log("Manual parsing attempt for:", text);

  const result: AnalyzedContent = {};

  // Extract product code (everything after #)
  const codeMatch = text.match(/#([A-Za-z0-9]+)/);
  if (codeMatch) {
    result.product_code = codeMatch[1];
    
    // Extract vendor (letters at start of product code)
    const vendorMatch = result.product_code.match(/^([A-Za-z]+)/);
    if (vendorMatch) {
      result.vendor_uid = vendorMatch[1];
    }
  }

  // Extract quantity (x followed by number)
  const quantityMatch = text.match(/x\s*(\d+)/i);
  if (quantityMatch) {
    result.quantity = parseInt(quantityMatch[1]);
  }

  // Extract notes (text in parentheses)
  const notesMatch = text.match(/\((.*?)\)/);
  if (notesMatch) {
    result.notes = notesMatch[1].trim();
  }

  // Extract product name (everything before #)
  const productNameMatch = text.split("#")[0];
  if (productNameMatch) {
    result.product_name = productNameMatch.trim();
  }

  console.log("Manual parsing result:", result);
  return result;
}