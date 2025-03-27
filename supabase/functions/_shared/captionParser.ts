
import { AnalyzedContent } from "./types.ts";

/**
 * Standard caption parser that converts caption text to analyzed content
 */
export function xdelo_parseCaption(caption: string): AnalyzedContent {
  const trimmedCaption = caption.trim();
  const currentTimestamp = new Date().toISOString();
  
  // Initialize with default values
  const analyzedContent: AnalyzedContent = {
    product_name: '',
    product_code: '',
    vendor_uid: undefined,
    purchase_date: undefined,
    quantity: undefined,
    notes: '',
    parsing_metadata: {
      method: 'manual',
      timestamp: currentTimestamp,
    }
  };
  
  // Handle empty captions
  if (!trimmedCaption) {
    return {
      ...analyzedContent,
      parsing_metadata: {
        ...analyzedContent.parsing_metadata,
        partial_success: true,
        missing_fields: ['product_name', 'product_code', 'vendor_uid', 'purchase_date', 'quantity']
      }
    };
  }
  
  // Track missing fields for partial success
  const missingFields: string[] = [];
  
  try {
    // Multi-line vs single-line parsing
    if (trimmedCaption.includes('\n')) {
      // Multi-line caption
      const lines = trimmedCaption.split('\n');
      
      // Extract product name from first line
      if (lines.length > 0 && lines[0].trim()) {
        analyzedContent.product_name = lines[0].trim().replace(/^['"]|['"]$/g, '');
      } else {
        missingFields.push('product_name');
      }
      
      // Find line with product code
      let codeLineIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('#')) {
          codeLineIdx = i;
          break;
        }
      }
      
      // Extract product code if found
      if (codeLineIdx >= 0) {
        const codeMatch = lines[codeLineIdx].match(/#([A-Za-z0-9-]+)/);
        if (codeMatch) {
          analyzedContent.product_code = codeMatch[1];
          
          // Extract vendor UID from product code
          const vendorMatch = codeMatch[1].match(/^([A-Za-z]{1,4})/);
          if (vendorMatch) {
            analyzedContent.vendor_uid = vendorMatch[1].toUpperCase();
          } else {
            missingFields.push('vendor_uid');
          }
          
          // Extract purchase date from product code
          const dateMatch = codeMatch[1].match(/^[A-Za-z]{1,4}(\d{5,6})/);
          if (dateMatch) {
            const dateDigits = dateMatch[1];
            try {
              analyzedContent.purchase_date = formatPurchaseDate(dateDigits);
            } catch (e) {
              missingFields.push('purchase_date');
            }
          } else {
            missingFields.push('purchase_date');
          }
        } else {
          missingFields.push('product_code');
          missingFields.push('vendor_uid');
          missingFields.push('purchase_date');
        }
      } else {
        missingFields.push('product_code');
        missingFields.push('vendor_uid');
        missingFields.push('purchase_date');
      }
      
      // Gather remaining lines as notes
      if (lines.length > 1) {
        const noteLines: string[] = [];
        for (let i = 1; i < lines.length; i++) {
          if (i !== codeLineIdx) {
            noteLines.push(lines[i].trim());
          }
        }
        analyzedContent.notes = noteLines.join('\n').trim();
      }
      
      // Look for quantity in notes
      if (analyzedContent.notes) {
        const qtyMatch = analyzedContent.notes.match(/(?:^|\s)x\s*(\d+)(?:\s|$)/i);
        if (qtyMatch) {
          analyzedContent.quantity = parseInt(qtyMatch[1], 10);
          analyzedContent.parsing_metadata.quantity_pattern = `x${qtyMatch[1]}`;
          // Remove quantity from notes
          analyzedContent.notes = analyzedContent.notes.replace(qtyMatch[0], ' ').trim();
        } else {
          const altQtyMatch = analyzedContent.notes.match(/(?:^|\s)(\d+)\s*x(?:\s|$)/i);
          if (altQtyMatch) {
            analyzedContent.quantity = parseInt(altQtyMatch[1], 10);
            analyzedContent.parsing_metadata.quantity_pattern = `${altQtyMatch[1]}x`;
            // Remove quantity from notes
            analyzedContent.notes = analyzedContent.notes.replace(altQtyMatch[0], ' ').trim();
          } else {
            missingFields.push('quantity');
          }
        }
      } else {
        missingFields.push('quantity');
      }
    } else {
      // Single line caption
      
      // Simple case: Just quantity "14x"
      const simpleQtyMatch = trimmedCaption.match(/^(\d+)x$/);
      if (simpleQtyMatch) {
        analyzedContent.quantity = parseInt(simpleQtyMatch[1], 10);
        analyzedContent.parsing_metadata.quantity_pattern = trimmedCaption;
        missingFields.push('product_name');
        missingFields.push('product_code');
        missingFields.push('vendor_uid');
        missingFields.push('purchase_date');
      } else {
        // Complex case
        const productCodeMatch = trimmedCaption.match(/#([A-Za-z0-9-]+)/);
        if (productCodeMatch) {
          // Extract product code
          analyzedContent.product_code = productCodeMatch[1];
          
          // Extract product name (text before code)
          const beforeCodeText = trimmedCaption.substring(0, trimmedCaption.indexOf('#')).trim();
          if (beforeCodeText) {
            analyzedContent.product_name = beforeCodeText;
          } else {
            missingFields.push('product_name');
          }
          
          // Extract vendor UID
          const vendorMatch = productCodeMatch[1].match(/^([A-Za-z]{1,4})/);
          if (vendorMatch) {
            analyzedContent.vendor_uid = vendorMatch[1].toUpperCase();
          } else {
            missingFields.push('vendor_uid');
          }
          
          // Extract purchase date
          const dateMatch = productCodeMatch[1].match(/^[A-Za-z]{1,4}(\d{5,6})/);
          if (dateMatch) {
            const dateDigits = dateMatch[1];
            try {
              analyzedContent.purchase_date = formatPurchaseDate(dateDigits);
            } catch (e) {
              missingFields.push('purchase_date');
            }
          } else {
            missingFields.push('purchase_date');
          }
          
          // Extract quantity
          const qtyMatch = trimmedCaption.match(/x\s*(\d+)/i);
          if (qtyMatch) {
            analyzedContent.quantity = parseInt(qtyMatch[1], 10);
            analyzedContent.parsing_metadata.quantity_pattern = `x${qtyMatch[1]}`;
          } else {
            const altQtyMatch = trimmedCaption.match(/(\d+)\s*x/i);
            if (altQtyMatch) {
              analyzedContent.quantity = parseInt(altQtyMatch[1], 10);
              analyzedContent.parsing_metadata.quantity_pattern = `${altQtyMatch[1]}x`;
            } else {
              missingFields.push('quantity');
            }
          }
          
          // Extract notes (content in parentheses)
          const notesMatch = trimmedCaption.match(/\(([^)]+)\)/);
          if (notesMatch) {
            analyzedContent.notes = notesMatch[1].trim();
          } else {
            // Use text after product code and quantity as notes
            const afterCodeText = trimmedCaption.substring(
              trimmedCaption.indexOf('#') + productCodeMatch[0].length
            ).trim();
            
            if (afterCodeText) {
              // Remove quantity pattern if present
              let notes = afterCodeText;
              if (analyzedContent.parsing_metadata.quantity_pattern) {
                notes = notes.replace(analyzedContent.parsing_metadata.quantity_pattern, '').trim();
              }
              if (notes) {
                analyzedContent.notes = notes;
              }
            }
          }
        } else {
          // No product code found
          analyzedContent.product_name = trimmedCaption;
          missingFields.push('product_code');
          missingFields.push('vendor_uid');
          missingFields.push('purchase_date');
          missingFields.push('quantity');
        }
      }
    }
    
    // Mark partial success if we have a product name but are missing other fields
    if (analyzedContent.product_name) {
      if (missingFields.length > 0) {
        analyzedContent.parsing_metadata.partial_success = true;
        analyzedContent.parsing_metadata.missing_fields = missingFields;
      }
    } else {
      // Missing required product name
      analyzedContent.parsing_metadata.partial_success = true;
      if (!missingFields.includes('product_name')) {
        missingFields.push('product_name');
      }
      analyzedContent.parsing_metadata.missing_fields = missingFields;
    }
    
    return analyzedContent;
  } catch (error) {
    console.error("Error parsing caption:", error);
    return {
      ...analyzedContent,
      parsing_metadata: {
        ...analyzedContent.parsing_metadata,
        partial_success: true,
        error: error.message,
        missing_fields: ['product_name', 'product_code', 'vendor_uid', 'purchase_date', 'quantity']
      }
    };
  }
}

function formatPurchaseDate(dateDigits: string): string {
  // Add leading zero for 5-digit dates
  const normalizedDigits = dateDigits.length === 5 ? `0${dateDigits}` : dateDigits;
  
  if (normalizedDigits.length !== 6) {
    throw new Error(`Invalid date format: ${dateDigits}`);
  }
  
  // Format is mmDDyy
  const month = normalizedDigits.substring(0, 2);
  const day = normalizedDigits.substring(2, 4);
  const year = normalizedDigits.substring(4, 6);
  
  // Convert to YYYY-MM-DD
  const fullYear = `20${year}`; // Assuming 20xx year
  
  // Validate date
  const dateObj = new Date(`${fullYear}-${month}-${day}`);
  if (isNaN(dateObj.getTime())) {
    throw new Error(`Invalid date: ${month}/${day}/${fullYear}`);
  }
  
  return `${fullYear}-${month}-${day}`;
}
