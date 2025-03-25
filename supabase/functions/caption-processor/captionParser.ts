/**
 * Caption parser module for extracting structured data from message captions
 */

export interface AnalysisResult {
  productName?: string;
  productCode?: string;
  vendorUID?: string;
  purchaseDate?: string;
  quantity?: number;
  notes?: string;
}

export interface ParseResult {
  result: AnalysisResult;
  partial_success: boolean;
  missing_fields: string[];
}

/**
 * Parse a caption to extract structured product data
 * 
 * @param caption The message caption to parse
 * @returns Structured product data and parsing metadata
 */
export function parseCaption(caption: string): ParseResult {
  const result: AnalysisResult = {};
  const missing = [];
  
  try {
    // Clean up caption
    const cleanCaption = caption.trim();

    // Try to extract product name, code, quantity, and notes
    const productInfo = extractProductInfo(cleanCaption);
    
    // Assign extracted values
    result.productName = productInfo.productName;
    if (!result.productName) missing.push('productName');
    
    result.productCode = productInfo.productCode;
    if (!result.productCode) missing.push('productCode');
    
    result.quantity = productInfo.quantity;
    if (result.quantity === undefined) missing.push('quantity');
    
    result.notes = productInfo.notes;
    
    // Extract vendor UID from product code
    if (result.productCode) {
      result.vendorUID = extractVendorUID(result.productCode);
      if (!result.vendorUID) missing.push('vendorUID');
      
      // Extract purchase date from product code
      result.purchaseDate = extractPurchaseDate(result.productCode);
      if (!result.purchaseDate) missing.push('purchaseDate');
    } else {
      missing.push('vendorUID', 'purchaseDate');
    }
    
    return {
      result,
      partial_success: missing.length > 0 && missing.length < 5, // Partial success if some fields were extracted
      missing_fields: missing
    };
  } catch (error) {
    console.error('Error parsing caption:', error);
    
    return {
      result,
      partial_success: Object.keys(result).length > 0,
      missing_fields: ['parsing_error', ...missing]
    };
  }
}

/**
 * Extract product information from caption
 */
function extractProductInfo(caption: string): {
  productName?: string;
  productCode?: string;
  quantity?: number;
  notes?: string;
} {
  const result: {
    productName?: string;
    productCode?: string;
    quantity?: number;
    notes?: string;
  } = {};
  
  // Check for hash code pattern (#CODE)
  const hashCodePattern = /#([A-Z0-9]{3,12})/i;
  const hashMatch = caption.match(hashCodePattern);
  
  // Check for quantity pattern (x NUM or NUM x)
  const quantityPatternAfter = /x\s*(\d+)/i;
  const quantityPatternBefore = /(\d+)\s*x/i;
  const quantityMatchAfter = caption.match(quantityPatternAfter);
  const quantityMatchBefore = caption.match(quantityPatternBefore);
  
  // Check for notes pattern (text in parentheses)
  const notesPattern = /\(([^)]+)\)/;
  const notesMatch = caption.match(notesPattern);
  
  // Extract product code if found
  if (hashMatch) {
    result.productCode = hashMatch[1].toUpperCase();
  }
  
  // Extract quantity if found
  if (quantityMatchAfter) {
    result.quantity = parseInt(quantityMatchAfter[1], 10);
  } else if (quantityMatchBefore) {
    result.quantity = parseInt(quantityMatchBefore[1], 10);
  }
  
  // Extract notes if found
  if (notesMatch) {
    result.notes = notesMatch[1].trim();
  }
  
  // Extract product name based on patterns
  // Standard format: "Product Name #CODE x Quantity"
  if (hashMatch) {
    const beforeHash = caption.split('#')[0].trim();
    if (beforeHash) {
      // If there's quantity pattern before product name, remove it
      if (quantityMatchBefore && beforeHash.includes(quantityMatchBefore[0])) {
        result.productName = beforeHash.replace(quantityMatchBefore[0], '').trim();
      } else {
        result.productName = beforeHash;
      }
    }
  } else if (quantityMatchAfter || quantityMatchBefore) {
    // If no hash code but quantity exists, use text before quantity as product name
    let productText = '';
    if (quantityMatchAfter) {
      productText = caption.split(quantityMatchAfter[0])[0].trim();
    } else if (quantityMatchBefore) {
      productText = caption.split(quantityMatchBefore[0])[0].trim();
    }
    
    // Remove notes from product name if present
    if (notesMatch && productText.includes(notesMatch[0])) {
      productText = productText.replace(notesMatch[0], '').trim();
    }
    
    result.productName = productText;
  } else {
    // No structured pattern found, use whole caption as product name
    let productText = caption;
    
    // Remove notes from product name if present
    if (notesMatch) {
      productText = productText.replace(notesMatch[0], '').trim();
    }
    
    result.productName = productText;
  }
  
  return result;
}

/**
 * Extract vendor UID from product code
 */
function extractVendorUID(productCode: string): string | undefined {
  // Vendor UID is typically the first few letters of the product code
  const vendorPattern = /^([A-Z]{1,4})/;
  const match = productCode.match(vendorPattern);
  
  return match ? match[1] : undefined;
}

/**
 * Extract purchase date from product code
 */
function extractPurchaseDate(productCode: string): string | undefined {
  // Purchase date format: MMDDYY at the end of vendor code
  // Example: HEFF022425 -> 02/24/25
  
  // Try to match 6 digits (MMDDYY) pattern, allowing for some non-digit chars in between
  const datePattern = /(\d{2})[\D]?(\d{2})[\D]?(\d{2})$/;
  const match = productCode.match(datePattern);
  
  if (match) {
    // Format as MM/DD/YY
    return `${match[1]}/${match[2]}/${match[3]}`;
  }
  
  return undefined;
} 