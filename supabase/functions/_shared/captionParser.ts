
// Shared caption parser for both edge functions and direct database functions

export interface ParsedContent {
  product_name: string;
  product_code: string;
  vendor_uid: string | null; // Make vendor_uid optional
  purchase_date: string | null; // Make purchase_date optional
  quantity: number | null;
  notes: string;
  caption: string;
  parsing_metadata: {
    method: 'manual';
    timestamp: string;
    partial_success?: boolean; // New flag for partial success
    missing_fields?: string[]; // Track which fields couldn't be parsed
    quantity_pattern?: string;
    used_fallback?: boolean;
    original_caption?: string;
    is_edit?: boolean;
    edit_timestamp?: string;
    retry_count?: number;
    retry_timestamp?: string;
    error?: string;
  };
  sync_metadata?: {
    media_group_id?: string;
    sync_source_message_id?: string;
  };
}

// Helper function to format purchase date
export function formatPurchaseDate(dateDigits: string): string {
  // Add leading zero for 5-digit dates (missing leading zero in month)
  const normalizedDigits = dateDigits.length === 5 ? '0' + dateDigits : dateDigits;
  
  if (normalizedDigits.length !== 6) {
    throw new Error(`Invalid date format: ${dateDigits}`);
  }
  
  // Format is mmDDyy
  const month = normalizedDigits.substring(0, 2);
  const day = normalizedDigits.substring(2, 4);
  const year = normalizedDigits.substring(4, 6);
  
  // Convert to YYYY-MM-DD
  const fullYear = '20' + year; // Assuming 20xx year
  
  // Validate date
  const dateObj = new Date(`${fullYear}-${month}-${day}`);
  if (isNaN(dateObj.getTime())) {
    throw new Error(`Invalid date: ${month}/${day}/${fullYear}`);
  }
  
  return `${fullYear}-${month}-${day}`;
}

// Main caption parsing function
export function xdelo_parseCaption(caption: string): ParsedContent {
  const trimmedCaption = caption.trim();
  const currentTimestamp = new Date().toISOString();
  
  // Initialize with default values
  const parsedContent: ParsedContent = {
    product_name: '',
    product_code: '',
    vendor_uid: null,
    purchase_date: null,
    quantity: null,
    notes: '',
    caption: trimmedCaption,
    parsing_metadata: {
      method: 'manual',
      timestamp: currentTimestamp,
      partial_success: false,
      missing_fields: []
    }
  };
  
  // If empty caption, return early
  if (!trimmedCaption) {
    parsedContent.parsing_metadata.error = 'Empty caption';
    parsedContent.parsing_metadata.partial_success = true;
    parsedContent.parsing_metadata.missing_fields = ['product_name', 'product_code', 'vendor_uid', 'purchase_date', 'quantity'];
    return parsedContent;
  }
  
  try {
    // Track missing fields for partial success
    const missingFields: string[] = [];
    
    // Handle multi-line captions
    if (trimmedCaption.includes('\n')) {
      return handleMultilineCaption(trimmedCaption, parsedContent, missingFields);
    }
    
    // Handle simple edge cases first
    
    // Case: Just a quantity like "14x"
    if (/^\d+x$/i.test(trimmedCaption)) {
      const match = trimmedCaption.match(/^(\d+)x$/i);
      if (match) {
        parsedContent.quantity = parseInt(match[1], 10);
        parsedContent.parsing_metadata.quantity_pattern = trimmedCaption;
        missingFields.push('product_name', 'product_code', 'vendor_uid', 'purchase_date');
        parsedContent.parsing_metadata.partial_success = true;
        parsedContent.parsing_metadata.missing_fields = missingFields;
        return parsedContent;
      }
    }
    
    // Case: Just a product name like "Gelato Cake"
    if (!trimmedCaption.includes('#') && !trimmedCaption.includes('x')) {
      parsedContent.product_name = trimmedCaption;
      missingFields.push('product_code', 'vendor_uid', 'purchase_date', 'quantity');
      parsedContent.parsing_metadata.partial_success = true;
      parsedContent.parsing_metadata.missing_fields = missingFields;
      return parsedContent;
    }
    
    // Case: Simple product name with quantity like "Mochi x 1"
    if (!trimmedCaption.includes('#') && /x\s*\d+$/i.test(trimmedCaption)) {
      const match = trimmedCaption.match(/^(.+?)\s+x\s*(\d+)$/i);
      if (match) {
        parsedContent.product_name = match[1].trim();
        parsedContent.quantity = parseInt(match[2], 10);
        parsedContent.parsing_metadata.quantity_pattern = `x ${match[2]}`;
        missingFields.push('product_code', 'vendor_uid', 'purchase_date');
        parsedContent.parsing_metadata.partial_success = true;
        parsedContent.parsing_metadata.missing_fields = missingFields;
        return parsedContent;
      }
    }
    
    // For more complex cases, identify key components
    
    // Find product codes - we need to handle multiple # patterns
    const allHashMatches = Array.from(trimmedCaption.matchAll(/#([A-Za-z0-9-]+)/g));
    
    // Special case: "Platinum #2 #HEFF022425 x 1 (30 + behind)"
    const hashNumberAndCodePattern = /^(.+?)\s+(#\d+)\s+(#[A-Za-z]{1,4}\d{5,6})/;
    const specialMatch = trimmedCaption.match(hashNumberAndCodePattern);
    
    if (specialMatch) {
      // We have a pattern like "Product #N #CODE"
      parsedContent.product_name = (specialMatch[1] + ' ' + specialMatch[2]).trim();
      const codeWithHash = specialMatch[3];
      const codeMatch = codeWithHash.match(/#([A-Za-z0-9-]+)/);
      
      if (codeMatch) {
        parsedContent.product_code = codeMatch[1];
        extractVendorAndDate(parsedContent, codeMatch[1], missingFields);
      }
      
      // Look for quantity and notes in the remaining text
      const remainingText = trimmedCaption.substring(trimmedCaption.indexOf(codeWithHash) + codeWithHash.length).trim();
      
      // Find quantity in remaining text
      const xQuantityMatch = remainingText.match(/x\s*(\d+)/i);
      if (xQuantityMatch) {
        parsedContent.quantity = parseInt(xQuantityMatch[1], 10);
        parsedContent.parsing_metadata.quantity_pattern = xQuantityMatch[0].trim();
      } else {
        missingFields.push('quantity');
      }
      
      // Find notes in remaining text
      const notesMatch = remainingText.match(/\(([^)]+)\)/);
      if (notesMatch) {
        parsedContent.notes = notesMatch[1].trim();
      }
    } else {
      // Find vendor-style product code (letters followed by numbers)
      let productCodeMatch = null;
      let productCodeIndex = -1;
      
      // First look for standard vendor pattern
      const vendorCodeMatch = allHashMatches.find(match => 
        /^[A-Za-z]{1,4}\d{5,6}$/.test(match[1])
      );
      
      if (vendorCodeMatch) {
        productCodeMatch = vendorCodeMatch;
        productCodeIndex = trimmedCaption.indexOf(vendorCodeMatch[0]);
      } else if (allHashMatches.length > 0) {
        // Use the hash pattern that doesn't look like a product number (#N)
        const nonNumberCodes = allHashMatches.filter(match => 
          !/^#\d+$/.test(match[0])
        );
        
        if (nonNumberCodes.length > 0) {
          productCodeMatch = nonNumberCodes[0];
          productCodeIndex = trimmedCaption.indexOf(productCodeMatch[0]);
        }
      }
      
      // Find quantity patterns
      const xQuantityMatch = trimmedCaption.match(/x\s*(\d+)/i); // "x 4"
      const xQuantityIndex = xQuantityMatch ? trimmedCaption.indexOf(xQuantityMatch[0]) : -1;
      
      const reverseXMatch = trimmedCaption.match(/(\d+)\s*x(?!\w)/i); // "4x" 
      const reverseXIndex = reverseXMatch ? trimmedCaption.indexOf(reverseXMatch[0]) : -1;
      
      // Find notes in parentheses
      const notesMatch = trimmedCaption.match(/\(([^)]+)\)/);
      const notesIndex = notesMatch ? trimmedCaption.indexOf(notesMatch[0]) : -1;
      
      // Extract product name based on indices
      if (productCodeMatch) {
        // Default approach: Extract everything before the code
        let nameEndIndex = productCodeIndex;
        
        // If quantity or notes come before code, adjust end index
        if (xQuantityIndex !== -1 && xQuantityIndex < nameEndIndex) {
          nameEndIndex = xQuantityIndex;
        }
        
        if (notesIndex !== -1 && notesIndex < nameEndIndex) {
          nameEndIndex = notesIndex;
        }
        
        // Extract product name
        if (nameEndIndex > 0) {
          parsedContent.product_name = trimmedCaption.substring(0, nameEndIndex).trim();
        }
        
        // Special case: Handle pattern like "Super Boof 1004 x 4 #FISH121024"
        if (xQuantityMatch && xQuantityIndex > 0) {
          const textBeforeQty = trimmedCaption.substring(0, xQuantityIndex).trim();
          // Check if there's a number at the end of the text before quantity
          const numberSuffixMatch = textBeforeQty.match(/^(.*\s+)(\d+)$/);
          
          if (numberSuffixMatch) {
            parsedContent.product_name = textBeforeQty;
          }
        }
        
        // Extract product code components
        parsedContent.product_code = productCodeMatch[1];
        extractVendorAndDate(parsedContent, productCodeMatch[1], missingFields);
      } else {
        // No product code found
        missingFields.push('product_code', 'vendor_uid', 'purchase_date');
        
        // Try to extract product name based on other delimiters
        if (xQuantityIndex !== -1) {
          parsedContent.product_name = trimmedCaption.substring(0, xQuantityIndex).trim();
        } else if (reverseXIndex !== -1) {
          parsedContent.product_name = trimmedCaption.substring(0, reverseXIndex).trim();
        } else if (notesIndex !== -1) {
          parsedContent.product_name = trimmedCaption.substring(0, notesIndex).trim();
        } else {
          parsedContent.product_name = trimmedCaption;
        }
      }
      
      // Extract quantity
      if (xQuantityMatch) {
        parsedContent.quantity = parseInt(xQuantityMatch[1], 10);
        parsedContent.parsing_metadata.quantity_pattern = xQuantityMatch[0].trim();
      } else if (reverseXMatch) {
        parsedContent.quantity = parseInt(reverseXMatch[1], 10);
        parsedContent.parsing_metadata.quantity_pattern = reverseXMatch[0].trim();
      } else {
        missingFields.push('quantity');
      }
      
      // Extract notes
      if (notesMatch) {
        parsedContent.notes = notesMatch[1].trim();
      }
    }
    
    // Check for missing product name
    if (!parsedContent.product_name) {
      missingFields.push('product_name');
    }
    
    // Update metadata
    parsedContent.parsing_metadata.partial_success = missingFields.length > 0;
    if (missingFields.length > 0) {
      parsedContent.parsing_metadata.missing_fields = missingFields;
    }
    
    return parsedContent;
  } catch (error) {
    console.error('Error parsing caption:', error);
    parsedContent.parsing_metadata.error = error.message;
    parsedContent.parsing_metadata.partial_success = true;
    parsedContent.parsing_metadata.missing_fields = ['error'];
    return parsedContent;
  }
}

// Helper function to handle multi-line captions
function handleMultilineCaption(
  caption: string,
  parsedContent: ParsedContent,
  missingFields: string[]
): ParsedContent {
  const lines = caption.split('\n').map(line => line.trim());
  
  // Find the product code line (line with #)
  const codeLineIndex = lines.findIndex(line => line.includes('#'));
  
  // Get product name from first line (remove quotes if present)
  if (lines.length > 0) {
    parsedContent.product_name = lines[0].replace(/^["']|["']$/g, '').trim();
  } else {
    missingFields.push('product_name');
  }
  
  // If we found a line with product code
  if (codeLineIndex !== -1) {
    const codeMatch = lines[codeLineIndex].match(/#([A-Za-z0-9-]+)/);
    if (codeMatch) {
      parsedContent.product_code = codeMatch[1];
      extractVendorAndDate(parsedContent, codeMatch[1], missingFields);
    }
  } else {
    missingFields.push('product_code', 'vendor_uid', 'purchase_date');
  }
  
  // Remaining lines become notes
  if (lines.length > 1) {
    const noteLines = lines.slice(1).filter((_, i) => i !== (codeLineIndex - 1));
    if (noteLines.length > 0) {
      parsedContent.notes = noteLines.join('\n').trim();
    }
  }
  
  // Multi-line captions typically don't have quantities
  missingFields.push('quantity');
  
  // Update metadata
  parsedContent.parsing_metadata.partial_success = missingFields.length > 0;
  parsedContent.parsing_metadata.missing_fields = missingFields;
  
  return parsedContent;
}

// Helper function to extract vendor UID and purchase date
function extractVendorAndDate(
  parsedContent: ParsedContent,
  code: string,
  missingFields: string[]
): void {
  // Extract vendor UID (first 1-4 letters of product code)
  const vendorMatch = code.match(/^([A-Za-z]{1,4})/);
  if (vendorMatch) {
    parsedContent.vendor_uid = vendorMatch[1].toUpperCase();
  } else {
    missingFields.push('vendor_uid');
  }
  
  // Extract purchase date (digits after vendor letters)
  const dateMatch = code.match(/^[A-Za-z]{1,4}(\d{5,6})/);
  if (dateMatch) {
    const dateDigits = dateMatch[1];
    try {
      parsedContent.purchase_date = formatPurchaseDate(dateDigits);
    } catch (dateError) {
      console.log('Date parsing error:', dateError);
      missingFields.push('purchase_date');
    }
  } else {
    missingFields.push('purchase_date');
  }
}
