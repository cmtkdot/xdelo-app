import { ParsedContent } from './types.ts';
import { parseQuantity } from './quantityParser.ts';

export function manualParse(caption: string): ParsedContent {
  console.log("Starting enhanced manual parsing for:", caption);
  const result: ParsedContent = {};
  const fallbacks_used: string[] = [];

  const hashIndex = caption.indexOf('#');
  if (hashIndex > 0) {
    result.product_name = caption.substring(0, hashIndex).trim();
  } else {
    result.product_name = caption.trim();
    fallbacks_used.push('no_hash_product_name');
  }

  const codeMatch = caption.match(/#([A-Za-z0-9-]+)/);
  if (codeMatch) {
    result.product_code = codeMatch[1];
    
    const vendorMatch = result.product_code.match(/^([A-Za-z]{1,4})/);
    if (vendorMatch) {
      result.vendor_uid = vendorMatch[1];
      
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
      } else if (dateStr) {
        result.product_code = `${result.vendor_uid}-${dateStr}`;
        fallbacks_used.push('non_date_product_code');
      }
    }
  }

  const quantityResult = parseQuantity(caption);
  if (quantityResult) {
    result.quantity = quantityResult.value;
    result.parsing_metadata = {
      method: 'manual',
      confidence: fallbacks_used.length ? 0.7 : 0.9,
      fallbacks_used: fallbacks_used.length ? fallbacks_used : undefined,
      quantity_confidence: quantityResult.confidence,
      quantity_method: quantityResult.method,
      quantity_is_approximate: quantityResult.is_approximate,
      quantity_unit: quantityResult.unit,
      quantity_original: quantityResult.original_text
    };
  }

  const notesMatch = caption.match(/\((.*?)\)/);
  if (notesMatch) {
    result.notes = notesMatch[1].trim();
  } else {
    let remainingText = caption
      .replace(/#[A-Za-z0-9-]+/, '')
      .replace(/x\s*\d+/i, '')
      .replace(result.product_name || '', '')
      .trim()
      .replace(/^[-,\s]+/, '')
      .replace(/[-,\s]+$/, '');
    
    if (remainingText) {
      result.notes = remainingText;
      fallbacks_used.push('implicit_notes');
    }
  }

  if (!result.parsing_metadata) {
    result.parsing_metadata = {
      method: 'manual',
      confidence: fallbacks_used.length ? 0.7 : 0.9,
      fallbacks_used: fallbacks_used.length ? fallbacks_used : undefined
    };
  }

  console.log("Enhanced manual parsing result:", result);
  return result;
}