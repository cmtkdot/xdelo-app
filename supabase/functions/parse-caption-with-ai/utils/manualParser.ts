import { ParsedContent } from "../types.ts";
import { parseQuantity } from "./quantityParser.ts";

export function manualParse(caption: string): ParsedContent {
  console.log("Starting manual parsing for:", caption);
  const result: ParsedContent = {};
  const fallbacks_used: string[] = [];

  // Extract product name (text before # or x)
  const xIndex = caption.toLowerCase().indexOf('x');
  const hashIndex = caption.indexOf('#');
  let endIndex = caption.length;
  
  if (xIndex > 0) {
    endIndex = Math.min(endIndex, xIndex);
  }
  if (hashIndex > 0) {
    endIndex = Math.min(endIndex, hashIndex);
  }
  
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
          console.error("Date parsing error:", error);
          fallbacks_used.push('date_parse_error');
        }
      }
    }
  }

  // Parse quantity using the enhanced quantityParser
  const quantityResult = parseQuantity(caption);
  if (quantityResult) {
    result.quantity = quantityResult.value;
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

  result.parsing_metadata = {
    method: 'manual',
    confidence: fallbacks_used.length ? 0.7 : 0.9,
    fallbacks_used: fallbacks_used.length ? fallbacks_used : undefined
  };

  console.log("Manual parsing result:", result);
  return result;
}