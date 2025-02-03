import { ParsedContent } from "../index.ts";
import { parseQuantity } from "./quantityParser.ts";

export function manualParse(caption: string): ParsedContent {
  console.log("Starting manual parsing for:", caption);
  const result: ParsedContent = {};
  const fallbacks_used: string[] = [];

  // Extract product name (text before #)
  const hashIndex = caption.indexOf('#');
  if (hashIndex > 0) {
    result.product_name = caption.substring(0, hashIndex).trim();
  } else {
    result.product_name = caption.trim();
    fallbacks_used.push('no_hash_product_name');
  }

  // Extract product code and vendor UID
  const codeMatch = caption.match(/#([A-Za-z0-9-]+)/);
  if (codeMatch) {
    result.product_code = codeMatch[1];
    
    const vendorMatch = result.product_code.match(/^([A-Za-z]+)/);
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

  // Parse quantity
  const quantityResult = parseQuantity(caption);
  if (quantityResult) {
    result.quantity = quantityResult.value;
  }

  // Extract notes (text in parentheses)
  const notesMatch = caption.match(/\((.*?)\)/);
  if (notesMatch) {
    result.notes = notesMatch[1].trim();
  }

  console.log("Manual parsing result:", result);
  return result;
}