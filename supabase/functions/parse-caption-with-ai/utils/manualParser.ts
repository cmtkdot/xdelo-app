
interface ParsedResult {
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  purchase_date?: string;
  quantity?: number;
  notes?: string;
}

export async function parseManually(caption: string): Promise<ParsedResult | null> {
  if (!caption) return null;

  const result: ParsedResult = {};
  
  // Split caption into lines
  const lines = caption.split('\n');
  
  // Try to find product code (after #)
  const hashtagMatch = caption.match(/#([A-Za-z0-9-]+)/);
  if (hashtagMatch) {
    result.product_code = hashtagMatch[1];
    
    // Extract vendor UID (letters at start of code)
    const vendorMatch = result.product_code.match(/^[A-Za-z]+/);
    if (vendorMatch) {
      result.vendor_uid = vendorMatch[0];
    }
  }

  // Try to find quantity (after x)
  const quantityMatch = caption.match(/x\s*(\d+)/i);
  if (quantityMatch) {
    result.quantity = parseInt(quantityMatch[1]);
  }

  // Try to find purchase date (YYYY-MM-DD format)
  const dateMatch = caption.match(/\d{4}-\d{2}-\d{2}/);
  if (dateMatch) {
    result.purchase_date = dateMatch[0];
  }

  // Extract product name (everything before #)
  if (hashtagMatch) {
    const beforeHash = caption.split('#')[0].trim();
    if (beforeHash) {
      result.product_name = beforeHash;
    }
  }

  // If we found at least a product code, return the result
  return result.product_code ? result : null;
}
