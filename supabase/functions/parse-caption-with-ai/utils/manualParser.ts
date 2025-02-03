import { ParsedContent } from '../types';

export function parseCaption(text: string): ParsedContent {
  console.log("Starting manual parsing for:", text);
  const result: ParsedContent = {};

  // Product name (everything before #)
  const productNameMatch = text.split('#')[0].trim();
  if (productNameMatch) {
    result.product_name = productNameMatch;
  }

  // Product code (everything after # including vendor and date)
  const codeMatch = text.match(/#([A-Za-z0-9]+)/);
  if (codeMatch) {
    result.product_code = codeMatch[1];
    
    // Vendor (letters at start of product code)
    const vendorMatch = result.product_code.match(/^([A-Za-z]{1,4})/);
    if (vendorMatch) {
      result.vendor_uid = vendorMatch[1];
    }
  }

  // Quantity (x followed by number)
  const quantityMatch = text.match(/x\s*(\d+)(?!\d*\s*[a-zA-Z])/i);
  if (quantityMatch) {
    const quantity = parseInt(quantityMatch[1], 10);
    if (!isNaN(quantity) && quantity > 0) {
      result.quantity = quantity;
    }
  }

  // Notes (text in parentheses)
  const notesMatch = text.match(/\((.*?)\)/);
  if (notesMatch) {
    result.notes = notesMatch[1].trim();
  }

  console.log("Manual parsing result:", result);
  return result;
}