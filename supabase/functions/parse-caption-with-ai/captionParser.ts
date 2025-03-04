
import { ParsedContent } from './types.ts';

// Manual parsing logic for captions with improved handling for edge cases
export const parseCaption = (caption: string): ParsedContent => {
  if (!caption || caption.trim() === '') {
    return createEmptyResult(caption);
  }

  // Revised approach - extract quantity first
  let quantity: number | null = null;
  let quantityPattern = '';
  
  // Check for quantity patterns in order of specificity
  const patterns = [
    { regex: /qty:\s*(\d+)/i, name: 'qty-prefix' },               // qty: 2
    { regex: /quantity:\s*(\d+)/i, name: 'quantity-prefix' },     // quantity: 2
    { regex: /(\d+)\s*(?:pcs|pieces)/i, name: 'pcs-suffix' },     // 2 pcs or 2 pieces
    { regex: /(\d+)\s*(?:units?)/i, name: 'units-suffix' },       // 2 unit or 2 units
    { regex: /^.*?#.*?(?:\s+|$)(\d+)(?:\s|$)/i, name: 'after-code' }, // number after product code
    { regex: /(\d+)\s*(?=\s|$)/, name: 'standalone' },            // standalone number
    { regex: /x\s*(\d+)/i, name: 'x-prefix' },                    // x2 or x 2 (moved to end to avoid product name extraction issues)
    { regex: /(\d+)x/i, name: 'x-suffix' }                        // 18x (new pattern)
  ];

  for (const { regex, name } of patterns) {
    const match = caption.match(regex);
    if (match && match[1]) {
      const parsedQuantity = parseInt(match[1], 10);
      if (!isNaN(parsedQuantity) && parsedQuantity > 0 && parsedQuantity < 10000) {
        quantity = parsedQuantity;
        quantityPattern = name;
        break;
      }
    }
  }

  // Extract product name (text before #, line break, or x)
  // Modified to avoid stopping at every 'x'
  let productNameRegex = /^(.*?)(?=[#\n]|$)/;
  let productNameMatch = caption.match(productNameRegex);
  let product_name = productNameMatch ? productNameMatch[0].trim() : '';

  // Special handling for captions like "Bubba 18x" or "14x"
  if (!product_name && quantity !== null) {
    // If product name is empty but we found a quantity, use the caption as product name
    product_name = caption.trim();
    
    // Try to remove the quantity pattern from product name
    if (quantityPattern === 'x-suffix') {
      product_name = product_name.replace(/\s*\d+x\s*$/i, '').trim();
    } else if (quantityPattern === 'x-prefix') {
      product_name = product_name.replace(/\s*x\s*\d+\s*$/i, '').trim();
    }
  }

  // Fallback: If product name is still empty after processing, use the full caption
  if (!product_name) {
    product_name = caption.trim();
  }

  // Extract product code (text following #)
  const productCodeMatch = caption.match(/#([A-Za-z0-9-]+)/);
  const product_code = productCodeMatch ? productCodeMatch[1] : '';

  // Extract vendor UID (first 1-4 letters of product code)
  const vendorUidMatch = product_code.match(/^[A-Za-z]{1,4}/);
  const vendor_uid = vendorUidMatch ? vendorUidMatch[0].toUpperCase() : '';

  // Extract purchase date with improved handling
  const dateMatch = product_code.match(/\d{5,6}/);
  let purchase_date = '';
  if (dateMatch) {
    const dateStr = dateMatch[0];
    try {
      if (dateStr.length === 5) {
        // Format: mDDyy
        const month = dateStr[0];
        const day = dateStr.substring(1, 3);
        const year = dateStr.substring(3);
        
        // Validate day and month
        const monthNum = parseInt(month, 10);
        const dayNum = parseInt(day, 10);
        
        if (monthNum > 0 && monthNum <= 12 && dayNum > 0 && dayNum <= 31) {
          purchase_date = `20${year}-${month.padStart(2, '0')}-${day}`;
        }
      } else if (dateStr.length === 6) {
        // Format: mmDDyy
        const month = dateStr.substring(0, 2);
        const day = dateStr.substring(2, 4);
        const year = dateStr.substring(4);
        
        // Validate day and month
        const monthNum = parseInt(month, 10);
        const dayNum = parseInt(day, 10);
        
        if (monthNum > 0 && monthNum <= 12 && dayNum > 0 && dayNum <= 31) {
          purchase_date = `20${year}-${month}-${day}`;
        }
      }
    } catch (e) {
      console.error('Error parsing date:', e);
      purchase_date = '';
    }
  }

  // Extract notes (text in parentheses or remaining unclassified text)
  let notes = '';
  const notesMatch = caption.match(/\((.*?)\)/);
  if (notesMatch) {
    notes = notesMatch[1].trim();
  } else {
    // If no parentheses, try to extract any remaining text after product info
    const remainingText = caption.replace(/^.*?(?:[#\nx]|$)/, '')  // Remove product name
                               .replace(/#[A-Za-z0-9-]+/, '')       // Remove product code
                               .replace(/x\d+/i, '')               // Remove quantity
                               .trim();
    if (remainingText && remainingText !== caption) {
      notes = remainingText;
    }
  }

  return {
    product_name,
    product_code,
    vendor_uid,
    purchase_date,
    quantity,
    notes,
    caption,
    parsing_metadata: {
      method: 'manual',
      timestamp: new Date().toISOString(),
      quantity_pattern: quantityPattern || undefined,
      used_fallback: !productNameMatch || productNameMatch[0].trim() === '',
      original_caption: caption
    }
  };
};

// Helper function to create an empty result
function createEmptyResult(caption: string): ParsedContent {
  return {
    product_name: '',
    product_code: '',
    vendor_uid: '',
    purchase_date: '',
    quantity: null,
    notes: '',
    caption,
    parsing_metadata: {
      method: 'manual',
      timestamp: new Date().toISOString(),
      error: 'Empty caption'
    }
  };
}

// Check if a product name should be analyzed by AI
export const shouldUseAI = (productName: string): boolean => {
  return productName.length > 23;
};
