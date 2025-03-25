
/**
 * Shared caption parser utility for edge functions
 * Provides standardized caption parsing functionality across all services
 */

/**
 * Analysis result interface for caption parsing
 */
export interface AnalysisResult {
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  purchase_date?: string;
  quantity?: number;
  notes?: string;
  parsing_metadata?: {
    method: string;
    timestamp: string;
    partial_success?: boolean;
    missing_fields?: string[];
    [key: string]: any;
  };
}

/**
 * Parse a caption with the shared implementation
 * This calls the database function to parse captions consistently
 * 
 * @param caption The text caption to parse
 * @returns Structured product information extracted from the caption
 */
export function xdelo_parseCaption(caption: string): AnalysisResult {
  // Clean and normalize caption text
  const cleanCaption = caption.trim();
  
  if (!cleanCaption) {
    return {
      parsing_metadata: {
        method: 'shared_parser',
        timestamp: new Date().toISOString(),
        partial_success: true,
        missing_fields: ['product_name', 'product_code', 'vendor_uid', 'purchase_date', 'quantity'],
        error: 'Empty caption'
      }
    };
  }
  
  // Extract product information using regex patterns
  const result: AnalysisResult = {};
  const missing_fields: string[] = [];

  // Product code extraction (format: #CODE123)
  const codeMatch = cleanCaption.match(/#([A-Za-z0-9-]+)/i);
  if (codeMatch) {
    result.product_code = codeMatch[1].toUpperCase();
    
    // Extract vendor UID (first 1-4 letters of product code)
    const vendorMatch = result.product_code.match(/^([A-Z]{1,4})/);
    if (vendorMatch) {
      result.vendor_uid = vendorMatch[1];
    } else {
      missing_fields.push('vendor_uid');
    }
    
    // Extract purchase date (format: 6 digits after vendor code)
    const dateMatch = result.product_code.match(/^[A-Z]{1,4}(\d{6})/);
    if (dateMatch) {
      const dateDigits = dateMatch[1];
      const month = dateDigits.substring(0, 2);
      const day = dateDigits.substring(2, 4);
      const year = '20' + dateDigits.substring(4, 6);
      result.purchase_date = `${year}-${month}-${day}`;
    } else {
      missing_fields.push('purchase_date');
    }
  } else {
    missing_fields.push('product_code', 'vendor_uid', 'purchase_date');
  }
  
  // Quantity extraction (format: "x 5" or "5x")
  const qtyAfterMatch = cleanCaption.match(/x\s*(\d+)/i);
  const qtyBeforeMatch = cleanCaption.match(/(\d+)\s*x(?!\w)/i);
  
  if (qtyAfterMatch) {
    result.quantity = parseInt(qtyAfterMatch[1], 10);
  } else if (qtyBeforeMatch) {
    result.quantity = parseInt(qtyBeforeMatch[1], 10);
  } else {
    missing_fields.push('quantity');
  }
  
  // Notes extraction (text in parentheses)
  const notesMatch = cleanCaption.match(/\(([^)]+)\)/);
  if (notesMatch) {
    result.notes = notesMatch[1].trim();
  }
  
  // Product name extraction (best effort based on patterns)
  if (codeMatch) {
    // Extract text before the code
    const beforeCode = cleanCaption.split('#')[0].trim();
    if (beforeCode) {
      result.product_name = beforeCode;
    } else {
      missing_fields.push('product_name');
    }
  } else if (qtyAfterMatch) {
    // Extract text before "x quantity"
    result.product_name = cleanCaption.split('x')[0].trim();
  } else if (qtyBeforeMatch) {
    // Extract text after "quantity x"
    const parts = cleanCaption.split(qtyBeforeMatch[0]);
    if (parts.length > 1) {
      result.product_name = parts[1].trim();
    } else {
      missing_fields.push('product_name');
    }
  } else {
    // Use the whole caption if no patterns match
    result.product_name = cleanCaption;
  }
  
  // Add metadata
  result.parsing_metadata = {
    method: 'shared_parser',
    timestamp: new Date().toISOString(),
    partial_success: missing_fields.length > 0,
    missing_fields: missing_fields.length > 0 ? missing_fields : undefined
  };
  
  return result;
}
