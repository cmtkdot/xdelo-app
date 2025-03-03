
import { ParsedContent } from './types.ts';

// Manual parsing logic for captions
export const parseCaption = (caption: string): ParsedContent => {
  // Extract product name (text before #, line break, or x)
  const productNameMatch = caption.match(/^(.*?)(?=[#\nx]|$)/);
  const product_name = productNameMatch ? productNameMatch[0].trim() : '';

  // Extract product code (text following #)
  const productCodeMatch = caption.match(/#([A-Za-z0-9-]+)/);
  const product_code = productCodeMatch ? productCodeMatch[1] : '';

  // Extract vendor UID (first 1-4 letters of product code)
  const vendorUidMatch = product_code.match(/^[A-Za-z]{1,4}/);
  const vendor_uid = vendorUidMatch ? vendorUidMatch[0].toUpperCase() : '';

  // Extract purchase date
  const dateMatch = product_code.match(/\d{5,6}/);
  let purchase_date = '';
  if (dateMatch) {
    const dateStr = dateMatch[0];
    if (dateStr.length === 5) {
      // Format: mDDyy
      const month = dateStr[0];
      const day = dateStr.substring(1, 3);
      const year = dateStr.substring(3);
      purchase_date = `20${year}-${month.padStart(2, '0')}-${day}`;
    } else if (dateStr.length === 6) {
      // Format: mmDDyy
      const month = dateStr.substring(0, 2);
      const day = dateStr.substring(2, 4);
      const year = dateStr.substring(4);
      purchase_date = `20${year}-${month}-${day}`;
    }
  }

  // Extract quantity (number after x)
  const quantityMatch = caption.match(/x(\d+)/i);
  const quantity = quantityMatch ? parseInt(quantityMatch[1]) : null;

  // Extract notes (text in parentheses or remaining unclassified text)
  const notesMatch = caption.match(/\((.*?)\)/);
  const notes = notesMatch ? notesMatch[1].trim() : '';

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
      timestamp: new Date().toISOString()
    }
  };
};

// Check if a product name should be analyzed by AI
export const shouldUseAI = (productName: string): boolean => {
  return productName.length > 23;
};
