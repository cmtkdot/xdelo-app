
// Manual parsing logic for captions
export const parseCaption = (caption: string): {
  productName: string;
  productCode: string;
  vendorUid: string;
  purchaseDate: string;
  quantity: number | null;
  notes: string;
} => {
  // Extract product name (text before #, line break, or x)
  const productNameMatch = caption.match(/^(.*?)(?=[#\nx]|$)/);
  const productName = productNameMatch ? productNameMatch[0].trim() : '';

  // Extract product code (text following #)
  const productCodeMatch = caption.match(/#([A-Za-z0-9-]+)/);
  const productCode = productCodeMatch ? productCodeMatch[1] : '';

  // Extract vendor UID (first 1-4 letters of product code)
  const vendorUidMatch = productCode.match(/^[A-Za-z]{1,4}/);
  const vendorUid = vendorUidMatch ? vendorUidMatch[0].toUpperCase() : '';

  // Extract purchase date
  const dateMatch = productCode.match(/\d{5,6}/);
  let purchaseDate = '';
  if (dateMatch) {
    const dateStr = dateMatch[0];
    if (dateStr.length === 5) {
      // Format: mDDyy
      const month = dateStr[0];
      const day = dateStr.substring(1, 3);
      const year = dateStr.substring(3);
      purchaseDate = `20${year}-${month.padStart(2, '0')}-${day}`;
    } else if (dateStr.length === 6) {
      // Format: mmDDyy
      const month = dateStr.substring(0, 2);
      const day = dateStr.substring(2, 4);
      const year = dateStr.substring(4);
      purchaseDate = `20${year}-${month}-${day}`;
    }
  }

  // Extract quantity (number after x)
  const quantityMatch = caption.match(/x(\d+)/i);
  const quantity = quantityMatch ? parseInt(quantityMatch[1]) : null;

  // Extract notes (text in parentheses or remaining unclassified text)
  const notesMatch = caption.match(/\((.*?)\)/);
  const notes = notesMatch ? notesMatch[1].trim() : '';

  return {
    productName,
    productCode,
    vendorUid,
    purchaseDate,
    quantity,
    notes,
  };
};

// Check if a product name should be analyzed by AI
export const shouldUseAI = (productName: string): boolean => {
  return productName.length > 23;
};
