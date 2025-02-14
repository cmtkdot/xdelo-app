
import { ParsedContent } from "../types.ts";
import { parseQuantity } from "./quantityParser.ts";

export async function manualParse(caption: string): Promise<ParsedContent> {
  console.log("Starting manual parsing for:", caption);
  const result: ParsedContent = {};
  const fallbacks_used: string[] = [];

  // Extract product name (text before line break, dash, # or x)
  const xIndex = caption.toLowerCase().indexOf('x');
  const hashIndex = caption.indexOf('#');
  const lineBreakIndex = caption.indexOf('\n');
  const dashIndex = caption.indexOf('-');
  let endIndex = caption.length;
  
  if (xIndex > 0) {
    endIndex = Math.min(endIndex, xIndex);
  }
  if (hashIndex > 0) {
    endIndex = Math.min(endIndex, hashIndex);
  }
  if (lineBreakIndex > 0) {
    endIndex = Math.min(endIndex, lineBreakIndex);
  }
  if (dashIndex > 0) {
    endIndex = Math.min(endIndex, dashIndex);
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
  } else {
    fallbacks_used.push('no_product_code');
  }

  // Parse quantity using the enhanced quantityParser
  const quantityResult = parseQuantity(caption);
  if (quantityResult) {
    result.quantity = quantityResult.value;
  } else {
    fallbacks_used.push('no_quantity');
  }

  // Extract notes (capture flavor list and any remaining text)
  const flavorListMatch = caption.match(/FLAVORS?\n([\s\S]+)$/i);
  const notesInParentheses = caption.match(/\((.*?)\)/g);
  
  let notes: string[] = [];

  // Add flavor list if found
  if (flavorListMatch) {
    const flavorList = flavorListMatch[1]
      .split('\n')
      .filter(line => line.trim().startsWith('-'))
      .map(line => line.trim())
      .join('\n');
    if (flavorList) {
      notes.push(flavorList);
    }
  }

  // Add any text in parentheses
  if (notesInParentheses) {
    const parentheticalNotes = notesInParentheses
      .map(note => note.replace(/[()]/g, '').trim())
      .filter(note => note && !note.match(/^(Indica|Sativa|Hybrid)$/i)); // Filter out strain types alone
    if (parentheticalNotes.length) {
      notes.push(...parentheticalNotes);
    }
  }

  // Look for any remaining text that might be notes
  const analyzedParts = [
    result.product_name,
    result.product_code ? `#${result.product_code}` : '',
    result.quantity ? `x${result.quantity}` : ''
  ].filter(Boolean).join(' ');

  const remainingText = caption
    .replace(analyzedParts, '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => 
      line && 
      !line.toLowerCase().includes('flavor') &&
      !line.startsWith('-') &&
      !line.startsWith('#')
    )
    .join('\n')
    .trim();

  if (remainingText) {
    notes.push(remainingText);
  }

  // Combine all notes
  if (notes.length) {
    result.notes = notes.join('\n').trim();
  }

  const confidence = calculateConfidence(result, fallbacks_used, caption);
  
  result.parsing_metadata = {
    method: 'manual',
    confidence,
    fallbacks_used: fallbacks_used.length ? fallbacks_used : undefined,
    timestamp: new Date().toISOString()
  };

  console.log("Manual parsing result:", result);
  return result;
}

function calculateConfidence(result: ParsedContent, fallbacks: string[], caption: string): number {
  let confidence = 1.0;
  
  // Reduce confidence for missing required fields
  if (!result.product_name || result.product_name === caption) confidence -= 0.3;
  if (!result.product_code) confidence -= 0.2;
  if (!result.vendor_uid) confidence -= 0.15;
  if (!result.quantity) confidence -= 0.15;
  if (!result.purchase_date) confidence -= 0.1;
  
  // Additional confidence reduction for each fallback used
  confidence -= fallbacks.length * 0.05;
  
  // Ensure confidence stays between 0 and 1
  return Math.max(0, Math.min(1, confidence));
}
