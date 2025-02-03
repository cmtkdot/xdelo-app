import { AnalyzedContent } from "../types.ts";

export function parseManually(text: string): AnalyzedContent {
  console.log("Starting manual parsing for:", text);
  const result: AnalyzedContent = {};

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
      
      // Date (digits after vendor)
      const dateStr = result.product_code.substring(vendorMatch[1].length);
      if (dateStr.length === 5 || dateStr.length === 6) {
        try {
          // Pad with leading zero if 5 digits
          const paddedDate = dateStr.length === 5 ? '0' + dateStr : dateStr;
          const month = paddedDate.substring(0, 2);
          const day = paddedDate.substring(2, 4);
          const year = '20' + paddedDate.substring(4, 6);
          
          const date = new Date(`${year}-${month}-${day}`);
          if (!isNaN(date.getTime())) {
            result.purchase_date = `${year}-${month}-${day}`;
          }
        } catch (error) {
          console.error("Error parsing date:", error);
        }
      }
    }
  }

  // Quantity (x followed by number)
  const quantityMatch = text.match(/x\s*(\d+)/i);
  if (quantityMatch) {
    result.quantity = parseInt(quantityMatch[1]);
  }

  // Notes (text in parentheses or remaining text)
  const notesMatch = text.match(/\((.*?)\)/);
  if (notesMatch) {
    result.notes = notesMatch[1].trim();
  } else {
    // If no parentheses, look for any remaining text after the product code and quantity
    const remainingText = text
      .replace(/#[A-Za-z0-9]+/, '') // Remove product code
      .replace(/x\s*\d+/, '')      // Remove quantity
      .replace(productNameMatch, '') // Remove product name
      .trim();
    
    if (remainingText) {
      result.notes = remainingText;
    }
  }

  console.log("Manual parsing result:", result);
  return result;
}